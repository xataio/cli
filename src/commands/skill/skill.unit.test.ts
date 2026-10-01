import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildApplication, buildRouteMap, run } from '@stricli/core';
import type { LocalContext } from '~/context';
import { printTable } from '~/lib/cli-utils';
import { addGlobalFlags } from '~/lib/global-flags';
import { agentIds, getAgents, getDestinations } from './agents';
import { SkillRoute } from './index';
import { implementation } from './install';
import { installSkills } from './installer';
import { implementation as listSkills } from './list';
import { downloadSkill, metadataFile, readRegistry, validatePaths, type SkillFile } from './registry';

let directory: string;
const commit = 'a'.repeat(40);
const skillText = '---\nname: using-xata-cli\ndescription: Manage Xata databases.\n---\nInstructions\n';
const entry = (path: string, mode = '100644', type = 'blob') => ({ path, mode, type });
const tree = [
  entry('skills/using-xata-cli/SKILL.md'),
  entry('skills/using-xata-cli/reference/auth.md'),
  entry('skills/using-xata-cli/scripts/check.sh', '100755'),
  entry('mcp.json')
];

const registryFetch = async (input: string | URL | Request) => {
  const url = String(input);
  if (url.endsWith('/commits/HEAD')) return Response.json({ sha: commit });
  if (url.endsWith(`/git/trees/${commit}?recursive=1`)) return Response.json({ tree, truncated: false });
  if (!url.includes(`/${commit}/`)) throw new Error(`Unpinned request: ${url}`);
  if (url.endsWith('/SKILL.md')) return new Response(skillText);
  if (url.endsWith('/reference/auth.md')) return new Response('Reference bytes\r\n');
  if (url.endsWith('/scripts/check.sh')) return new Response('#!/bin/sh\necho example\n');
  throw new Error(`Unexpected request: ${url}`);
};

const preconnect = fetch.preconnect;
const setFetch = (handler: typeof registryFetch) =>
  spyOn(globalThis, 'fetch').mockImplementation(Object.assign(handler, { preconnect }));

beforeEach(() => {
  directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'xata-skills-test-')));
  setFetch(registryFetch);
});

afterEach(() => {
  mock.restore();
  fs.rmSync(directory, { recursive: true, force: true });
});

const context = (interactive = false, json = true) => {
  const stdout = mock();
  return {
    fs,
    path,
    os: { homedir: () => directory },
    env: {},
    isInteractive: interactive,
    outputJson: json,
    printTable,
    process: { cwd: () => directory, stdout: { write: stdout }, stderr: { write: mock() } },
    enquirer: {
      selectPrompt: mock(async () => 'using-xata-cli'),
      multiselectPrompt: mock(async () => ['claude-code']),
      confirmPrompt: mock(async () => false)
    }
  } as unknown as LocalContext;
};

const output = (ctx: LocalContext) =>
  JSON.parse((ctx.process.stdout.write as ReturnType<typeof mock>).mock.calls.map((call) => call[0]).join(''));
const files: SkillFile[] = [
  { path: 'SKILL.md', content: Buffer.from('original'), executable: false },
  { path: 'reference/auth.md', content: Buffer.from([0, 1, 255, 10]), executable: false }
];
const options = () => ({ force: false, approve: mock(async () => false), reportPlan: mock() });
const destination = () => [{ path: path.join(directory, '.agents/skills/example'), agents: ['Codex'] }];

test('registry discovery and complete downloads stay pinned and exclude package-level MCP configuration', async () => {
  const registry = await readRegistry();
  expect(registry.skills).toEqual([
    { name: 'using-xata-cli', description: 'Manage Xata databases.', path: 'skills/using-xata-cli' }
  ]);
  const downloaded = await downloadSkill(registry, registry.skills[0]!);
  expect(downloaded.map((file) => file.path)).toEqual([
    'SKILL.md',
    'reference/auth.md',
    'scripts/check.sh',
    metadataFile
  ]);
  expect(downloaded[1]?.content.toString()).toBe('Reference bytes\r\n');
  expect(downloaded[2]?.executable).toBe(true);
  expect(JSON.parse(downloaded[3]!.content.toString())).toEqual({
    version: 1,
    repository: 'xataio/skills',
    commit,
    path: 'skills/using-xata-cli'
  });
});

test('rejects incomplete registry responses and mismatched skill names', async () => {
  setFetch(async (input) =>
    String(input).includes('/git/trees/') ? Response.json({ tree, truncated: true }) : registryFetch(input)
  );
  await expect(readRegistry()).rejects.toThrow('incomplete');
  setFetch(async (input) =>
    String(input).endsWith('/SKILL.md')
      ? new Response(skillText.replace('name: using-xata-cli', 'name: other-skill'))
      : registryFetch(input)
  );
  await expect(readRegistry()).rejects.toThrow('does not match');
});

test('rejects traversal, Windows-invalid paths, case collisions, symlinks and gitlinks', () => {
  for (const name of ['../escape', '/absolute', 'a\\b', 'a:b', 'NUL.txt', 'trailing.', 'bad\0name', 'a//b']) {
    expect(() => validatePaths([entry(`skills/example/${name}`)])).toThrow('Unsafe');
  }
  expect(() => validatePaths([entry('a/A'), entry('a/a')])).toThrow('Colliding');
  expect(() => validatePaths([entry('link', '120000')])).toThrow('Unsupported');
  expect(() => validatePaths([entry('submodule', '160000', 'commit')])).toThrow('Unsupported');
});

test('JSON no-name install lists only, even on a terminal', async () => {
  const ctx = context(true);
  await implementation.call(ctx, {});
  expect(output(ctx).skills[0].name).toBe('using-xata-cli');
  expect(ctx.enquirer.selectPrompt).not.toHaveBeenCalled();
  expect(ctx.enquirer.multiselectPrompt).not.toHaveBeenCalled();
  expect(fs.readdirSync(directory)).toEqual([]);
  await expect(implementation.call(ctx, {}, 'using-xata-cli')).rejects.toThrow('Choose an agent');
  expect(ctx.enquirer.multiselectPrompt).not.toHaveBeenCalled();
});

test('interactive no-name install selects a skill before agents and fetches one snapshot', async () => {
  const ctx = context(true, false);
  const fetchMock = setFetch(async (input) => {
    if (String(input).includes('/git/trees/'))
      return Response.json({ tree: [entry('skills/another-skill/SKILL.md'), ...tree], truncated: false });
    if (String(input).endsWith('/another-skill/SKILL.md'))
      return new Response(skillText.replace('using-xata-cli', 'another-skill'));
    return registryFetch(input);
  });
  await implementation.call(ctx, {});
  expect(ctx.enquirer.selectPrompt).toHaveBeenCalledWith(true, 'Select a skill to install:', [
    { name: 'another-skill', message: 'another-skill' },
    { name: 'using-xata-cli', message: 'using-xata-cli' }
  ]);
  expect(ctx.enquirer.multiselectPrompt).toHaveBeenCalledTimes(1);
  expect(fs.existsSync(path.join(directory, '.claude/skills/using-xata-cli/SKILL.md'))).toBe(true);
  expect(fs.existsSync(path.join(directory, '.claude/skills/another-skill'))).toBe(false);
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/commits/HEAD'))).toHaveLength(1);
});

test('piped installs and explicit list remain read-only without prompts', async () => {
  for (const [ctx, action] of [
    [context(false, false), implementation],
    [context(true, false), listSkills]
  ] as const) {
    await action.call(ctx, {});
    expect(ctx.enquirer.selectPrompt).not.toHaveBeenCalled();
    expect(ctx.enquirer.multiselectPrompt).not.toHaveBeenCalled();
    expect(fs.readdirSync(directory)).toEqual([]);
  }
});

test('empty registry and cancelled skill selection never prompt for agents or write files', async () => {
  const ctx = context(true, false);
  ctx.enquirer.selectPrompt = mock(async () => '');
  await implementation.call(ctx, {});
  expect(ctx.enquirer.multiselectPrompt).not.toHaveBeenCalled();
  expect(fs.readdirSync(directory)).toEqual([]);
  mock.clearAllMocks();
  setFetch(async (input) =>
    String(input).includes('/git/trees/') ? Response.json({ tree: [], truncated: false }) : registryFetch(input)
  );
  await expect(implementation.call(ctx, {})).rejects.toThrow('No skills are available');
  expect(ctx.enquirer.selectPrompt).not.toHaveBeenCalled();
  expect(ctx.enquirer.multiselectPrompt).not.toHaveBeenCalled();
});

test('noninteractive missing agents and incompatible scope flags fail before network access', async () => {
  await expect(implementation.call(context(), {}, 'using-xata-cli')).rejects.toThrow('Choose an agent');
  await expect(implementation.call(context(), { global: true, directory: '.' }, 'using-xata-cli')).rejects.toThrow(
    'cannot be combined'
  );
  expect(fetch).not.toHaveBeenCalled();
});

test('named install prompts only when needed and preselects detected agents', async () => {
  fs.mkdirSync(path.join(directory, '.claude'));
  const ctx = context(true, false);
  await implementation.call(ctx, {}, 'using-xata-cli');
  expect(ctx.enquirer.selectPrompt).not.toHaveBeenCalled();
  expect(ctx.enquirer.multiselectPrompt).toHaveBeenCalledWith(
    true,
    'Install for which agents?',
    expect.any(Array),
    ['claude-code'],
    { searchable: true }
  );
  expect(fs.readFileSync(path.join(directory, '.claude/skills/using-xata-cli/SKILL.md'), 'utf8')).toBe(skillText);
});

test('explicit agents deduplicate project destinations; JSON is a single result', async () => {
  const ctx = context(true);
  await implementation.call(ctx, { agent: ['codex', 'cursor', 'amp', 'claude-code'] }, 'using-xata-cli');
  expect(output(ctx).results).toHaveLength(2);
  expect(output(ctx).results.find((result: { agents: string[] }) => result.agents.includes('Codex')).agents).toEqual([
    'Codex',
    'Cursor',
    'Amp'
  ]);
  expect(ctx.enquirer.multiselectPrompt).not.toHaveBeenCalled();
  expect(fs.readFileSync(path.join(directory, '.agents/skills/using-xata-cli/reference/auth.md'), 'utf8')).toBe(
    'Reference bytes\r\n'
  );
});

test('global destinations use documented overrides without moving Codex user skills into CODEX_HOME', () => {
  const agents = getAgents({
    home: directory,
    project: path.join(directory, 'project'),
    configHome: path.join(directory, 'config'),
    claudeConfig: path.join(directory, 'claude-custom'),
    codexHome: path.join(directory, 'codex-custom')
  });
  expect(
    getDestinations(agents, ['claude-code', 'codex', 'cursor', 'amp'], true, 'example').map((item) => item.path)
  ).toEqual([
    path.join(directory, 'claude-custom/skills/example'),
    path.join(directory, '.agents/skills/example'),
    path.join(directory, '.cursor/skills/example'),
    path.join(directory, 'config/agents/skills/example')
  ]);
});

test.each([undefined, ''])('unset or empty XDG_CONFIG_HOME (%s) uses the home config directory', (configHome) => {
  const agents = getAgents({ home: directory, project: path.join(directory, 'project'), configHome });
  expect(getDestinations(agents, ['amp', 'opencode'], true, 'example').map((item) => item.path)).toEqual([
    path.join(directory, '.config/agents/skills/example'),
    path.join(directory, '.config/opencode/skills/example')
  ]);
});

test('Stricli accepts plural alias, repeated agents and JSON', async () => {
  const app = buildApplication(
    addGlobalFlags(buildRouteMap({ docs: { brief: '' }, routes: { skill: SkillRoute }, aliases: { skills: 'skill' } })),
    { name: 'xata' }
  );
  const ctx = context();
  await run(app, ['skills', 'install', 'using-xata-cli', '--agent', 'codex', '--agent', 'cursor', '--json'], ctx);
  expect(output(ctx).results).toEqual([
    { path: path.join(directory, '.agents/skills/using-xata-cli'), agents: ['Codex', 'Cursor'], status: 'installed' }
  ]);
});

test('documented local MCP harnesses resolve distinct user paths and shared project paths', () => {
  const project = path.join(directory, 'project');
  const configHome = path.join(directory, 'custom-config');
  const agents = getAgents({ home: directory, project, configHome });
  expect(agents.map((agent) => agent.id)).toEqual([...agentIds]);
  const expected = [
    ['github-copilot', '.agents/skills', '.copilot/skills'],
    ['antigravity-cli', '.agents/skills', '.gemini/antigravity-cli/skills'],
    ['opencode', '.agents/skills', 'custom-config/opencode/skills'],
    ['windsurf', '.windsurf/skills', '.codeium/windsurf/skills'],
    ['zed', '.agents/skills', '.agents/skills'],
    ['cline', '.cline/skills', '.cline/skills']
  ] as const;
  for (const [id, local, global] of expected) {
    expect(getDestinations(agents, [id], false, 'example')[0]?.path).toBe(path.join(project, local, 'example'));
    expect(getDestinations(agents, [id], true, 'example')[0]?.path).toBe(path.join(directory, global, 'example'));
  }
  expect(
    getDestinations(
      agents,
      expected.map(([id]) => id),
      false,
      'example'
    )
  ).toHaveLength(3);
  expect(agents.every((agent) => !agent.detected)).toBe(true);
  for (const folder of [
    '.copilot',
    '.gemini/antigravity-cli',
    'custom-config/opencode',
    '.codeium/windsurf',
    'project/.zed',
    'project/.cline'
  ]) {
    fs.mkdirSync(path.join(directory, folder), { recursive: true });
  }
  expect(
    getAgents({ home: directory, project, configHome })
      .filter((agent) => agent.detected)
      .map((agent) => agent.id)
  ).toEqual(expected.map(([id]) => id));
});

test('all added agent IDs work through the command parser without prompting', async () => {
  const app = buildApplication(buildRouteMap({ docs: { brief: '' }, routes: { skill: SkillRoute } }), { name: 'xata' });
  const ctx = context();
  await run(
    app,
    [
      'skill',
      'install',
      'using-xata-cli',
      ...['github-copilot', 'antigravity-cli', 'opencode', 'windsurf', 'zed', 'cline'].flatMap((id) => ['--agent', id])
    ],
    ctx
  );
  expect(output(ctx).results).toHaveLength(3);
  for (const folder of ['.agents', '.windsurf', '.cline']) {
    expect(fs.readFileSync(path.join(directory, folder, 'skills/using-xata-cli/SKILL.md'), 'utf8')).toBe(skillText);
  }
  expect(ctx.enquirer.multiselectPrompt).not.toHaveBeenCalled();
});

test('download failure preserves existing installation without leaving staging files', async () => {
  const target = path.join(directory, '.agents/skills/using-xata-cli');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'SKILL.md'), 'local');
  setFetch(async (input) =>
    String(input).endsWith('/reference/auth.md') ? new Response('unavailable', { status: 503 }) : registryFetch(input)
  );
  await expect(implementation.call(context(), { agent: ['codex'], force: true }, 'using-xata-cli')).rejects.toThrow(
    '503'
  );
  expect(fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8')).toBe('local');
  expect(fs.readdirSync(path.dirname(target))).toEqual(['using-xata-cli']);
});

test('identical installs are no-ops; local edits and extra files require approval; force replaces cleanly', async () => {
  const targets = destination();
  const opts = options();
  expect((await installSkills(targets, files, opts))[0]?.status).toBe('installed');
  expect((await installSkills(targets, files, opts))[0]?.status).toBe('unchanged');
  expect(opts.approve).not.toHaveBeenCalled();
  const target = targets[0]!.path;
  fs.writeFileSync(path.join(target, 'extra.txt'), 'keep');
  expect((await installSkills(targets, files, opts))[0]?.status).toBe('skipped');
  expect(fs.readFileSync(path.join(target, 'extra.txt'), 'utf8')).toBe('keep');
  fs.writeFileSync(path.join(target, 'SKILL.md'), 'local edit');
  expect((await installSkills(targets, files, { ...opts, force: true }))[0]?.status).toBe('replaced');
  expect(fs.existsSync(path.join(target, 'extra.txt'))).toBe(false);
  expect(fs.readFileSync(path.join(target, 'reference/auth.md'))).toEqual(Buffer.from([0, 1, 255, 10]));
  expect(fs.readdirSync(path.dirname(target))).toEqual(['example']);
});

test('symlink destinations and parents are refused even with force', async () => {
  const outside = path.join(directory, 'outside');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'keep'), 'safe');
  const target = path.join(directory, 'link');
  fs.symlinkSync(outside, target, 'junction');
  for (const dest of [target, path.join(target, 'example')]) {
    await expect(
      installSkills([{ path: dest, agents: ['Codex'] }], files, { ...options(), force: true })
    ).rejects.toThrow('symlink');
  }
  expect(fs.readdirSync(outside)).toEqual(['keep']);
});

test('a concurrent install cannot replace a locked destination', async () => {
  const targets = destination();
  await installSkills(targets, files, options());
  await installSkills(targets, [{ ...files[0]!, content: Buffer.from('new') }], {
    ...options(),
    approve: async () => {
      await expect(installSkills(targets, files, { ...options(), force: true })).rejects.toThrow('Another install');
      return false;
    }
  });
  expect(fs.readFileSync(path.join(targets[0]!.path, 'SKILL.md'), 'utf8')).toBe('original');
});

test('edits made during approval abort replacement', async () => {
  const targets = destination();
  await installSkills(targets, files, options());
  await expect(
    installSkills(targets, [{ ...files[0]!, content: Buffer.from('new') }], {
      ...options(),
      approve: async () => {
        fs.writeFileSync(path.join(targets[0]!.path, 'SKILL.md'), 'edited during prompt');
        return true;
      }
    })
  ).rejects.toThrow('changed during');
  expect(fs.readFileSync(path.join(targets[0]!.path, 'SKILL.md'), 'utf8')).toBe('edited during prompt');
});

test('failed final rename restores the previous directory', async () => {
  const targets = destination();
  await installSkills(targets, files, options());
  const parent = path.dirname(targets[0]!.path);
  await expect(
    installSkills(targets, [{ ...files[0]!, content: Buffer.from('new') }], {
      ...options(),
      force: true,
      reportPlan: () => {
        const stage = fs.readdirSync(parent).find((name) => name.startsWith('.xata-skill-'))!;
        fs.rmSync(path.join(parent, stage, 'payload'), { recursive: true });
      }
    })
  ).rejects.toThrow();
  expect(fs.readFileSync(path.join(targets[0]!.path, 'SKILL.md'), 'utf8')).toBe('original');
  expect(fs.readdirSync(parent)).toEqual(['example']);
});

test('stage cleanup failure reports a completed install and still releases all locks', async () => {
  const targets = [
    { path: path.join(directory, 'a'), agents: ['Codex'] },
    { path: path.join(directory, 'b'), agents: ['Claude Code'] }
  ];
  await installSkills(targets, files, options());
  const remove = fsPromises.rm;
  let failedStage: string | undefined;
  spyOn(fsPromises, 'rm').mockImplementation(async (target, options) => {
    if (!failedStage && String(target).includes('.xata-skill-')) {
      failedStage = String(target);
      throw new Error('EBUSY: backup in use');
    }
    return remove(target, options);
  });
  await expect(
    installSkills(targets, [{ ...files[0]!, content: Buffer.from('new') }], { ...options(), force: true })
  ).rejects.toThrow('Installation completed, but cleanup failed');
  expect(fs.readFileSync(path.join(failedStage!, 'backup/SKILL.md'), 'utf8')).toBe('original');
  expect(fs.readdirSync(directory).sort()).toEqual([path.basename(failedStage!), 'a', 'b'].sort());
  for (const target of targets) expect(fs.readFileSync(path.join(target.path, 'SKILL.md'), 'utf8')).toBe('new');
  expect((await installSkills(targets, files, { ...options(), force: true })).map((item) => item.status)).toEqual([
    'replaced',
    'replaced'
  ]);
});

test('a lock cleanup failure does not prevent releasing subsequent locks', async () => {
  const targets = [
    { path: path.join(directory, 'a'), agents: ['Codex'] },
    { path: path.join(directory, 'b'), agents: ['Claude Code'] }
  ];
  const failedLock = `${targets[0]!.path}.xata-install-lock`;
  const remove = fsPromises.rm;
  spyOn(fsPromises, 'rm').mockImplementation(async (target, options) => {
    if (target === failedLock) throw new Error('EACCES: lock in use');
    return remove(target, options);
  });
  await expect(installSkills(targets, files, options())).rejects.toThrow(failedLock);
  expect(fs.readdirSync(directory).sort()).toEqual(['a', 'a.xata-install-lock', 'b']);
});

test('cleanup failure preserves the primary error and recovery path when restoring a backup also fails', async () => {
  const targets = [
    { path: path.join(directory, 'a'), agents: ['Codex'] },
    { path: path.join(directory, 'b'), agents: ['Claude Code'] }
  ];
  await installSkills(targets, files, options());
  const rename = fsPromises.rename;
  const remove = fsPromises.rm;
  let backup: string | undefined;
  let failedStage: string | undefined;
  spyOn(fsPromises, 'rename').mockImplementation(async (from, to) => {
    if (to === targets[1]!.path) {
      backup = path.join(path.dirname(String(from)), 'backup');
      throw new Error('EACCES: rename refused');
    }
    return rename(from, to);
  });
  spyOn(fsPromises, 'rm').mockImplementation(async (target, options) => {
    if (String(target).includes('.xata-skill-')) {
      failedStage = String(target);
      throw new Error('EBUSY: cleanup refused');
    }
    return remove(target, options);
  });
  const error = await installSkills(targets, [{ ...files[0]!, content: Buffer.from('new') }], {
    ...options(),
    force: true
  }).catch((error: unknown) => error);
  expect(error).toBeInstanceOf(AggregateError);
  expect((error as Error).message).toContain(`Installation partially completed at ${targets[0]!.path}`);
  expect((error as Error).message).toContain(`Your previous installation is preserved at ${backup}`);
  expect((error as Error).message).toContain(failedStage!);
  expect((error as Error).cause).toBeInstanceOf(Error);
  expect(fs.readFileSync(path.join(backup!, 'SKILL.md'), 'utf8')).toBe('original');
  expect(fs.readFileSync(path.join(targets[0]!.path, 'SKILL.md'), 'utf8')).toBe('new');
  expect(fs.existsSync(targets[1]!.path)).toBe(false);
  for (const target of targets) expect(fs.existsSync(`${target.path}.xata-install-lock`)).toBe(false);
});

test('global installs and project overrides do not write to the current project', async () => {
  const ctx = context();
  await implementation.call(ctx, { agent: ['amp'], global: true }, 'using-xata-cli');
  expect(fs.existsSync(path.join(directory, '.config/agents/skills/using-xata-cli/SKILL.md'))).toBe(true);
  expect(fs.existsSync(path.join(directory, '.agents'))).toBe(false);
  const project = path.join(directory, 'nested');
  fs.mkdirSync(project);
  await implementation.call(ctx, { agent: ['codex'], directory: project }, 'using-xata-cli');
  expect(fs.existsSync(path.join(project, '.agents/skills/using-xata-cli/SKILL.md'))).toBe(true);
  expect(fs.existsSync(path.join(directory, '.agents'))).toBe(false);
});

test('unknown skills and unknown agent arguments create no files', async () => {
  await expect(implementation.call(context(), { agent: ['codex'] }, '../escape')).rejects.toThrow('Unknown skill');
  expect(fs.readdirSync(directory)).toEqual([]);
  mock.clearAllMocks();
  const app = buildApplication(buildRouteMap({ docs: { brief: '' }, routes: { skill: SkillRoute } }), { name: 'xata' });
  const ctx = context();
  await run(app, ['skill', 'install', 'using-xata-cli', '--agent', 'unknown'], ctx);
  expect(ctx.process.exitCode).not.toBe(0);
  expect(fetch).not.toHaveBeenCalled();
  expect(fs.readdirSync(directory)).toEqual([]);
});

test('noninteractive conflict prevents committing any of the planned destinations', async () => {
  const targets = [
    { path: path.join(directory, 'a-new'), agents: ['Codex'] },
    { path: path.join(directory, 'b-existing'), agents: ['Claude Code'] }
  ];
  await installSkills([targets[1]!], files, options());
  await expect(
    installSkills(targets, [{ ...files[0]!, content: Buffer.from('new') }], {
      ...options(),
      approve: async () => {
        throw new Error('requires force');
      }
    })
  ).rejects.toThrow('requires force');
  expect(fs.existsSync(targets[0]!.path)).toBe(false);
  expect(fs.readFileSync(path.join(targets[1]!.path, 'SKILL.md'), 'utf8')).toBe('original');
});

test('partial completion reports successful destinations and restores a failing replacement', async () => {
  const targets = [
    { path: path.join(directory, 'a/new'), agents: ['Codex'] },
    { path: path.join(directory, 'b/existing'), agents: ['Claude Code'] }
  ];
  await installSkills([targets[1]!], files, options());
  await expect(
    installSkills(targets, [{ ...files[0]!, content: Buffer.from('new') }], {
      ...options(),
      force: true,
      reportPlan: () => {
        const parent = path.dirname(targets[1]!.path);
        const stage = fs.readdirSync(parent).find((name) => name.startsWith('.xata-skill-'))!;
        fs.rmSync(path.join(parent, stage, 'payload'), { recursive: true });
      }
    })
  ).rejects.toThrow(`Installation partially completed at ${targets[0]!.path}`);
  expect(fs.readFileSync(path.join(targets[0]!.path, 'SKILL.md'), 'utf8')).toBe('new');
  expect(fs.readFileSync(path.join(targets[1]!.path, 'SKILL.md'), 'utf8')).toBe('original');
});
