import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { agentIds, getAgents, getDestinations, type AgentId } from './agents';
import { installSkills } from './installer';
import { implementation as listSkills } from './list';
import { downloadSkill, readRegistry, repository } from './registry';

type Flags = { agent?: AgentId[]; global?: boolean; directory?: string; force?: boolean };

export const implementation = async function (this: LocalContext, flags: Flags, name?: string) {
  if (flags.global && flags.directory !== undefined) throw new Error('--global and --directory cannot be combined.');
  const interactive = this.isInteractive && !this.outputJson;
  if (!name && !interactive) return listSkills.call(this);
  if (!flags.agent?.length && !interactive)
    throw new Error(`Choose an agent: xata skill install ${name} --agent <${agentIds.join('|')}>`);
  const registry = await readRegistry();
  if (!registry.skills.length) throw new Error('No skills are available in xataio/skills.');
  const selectedName =
    name ??
    (await this.enquirer.selectPrompt(
      true,
      'Select a skill to install:',
      registry.skills.map((skill) => ({ name: skill.name, message: skill.name }))
    ));
  if (!selectedName) return;
  const skill = registry.skills.find((skill) => skill.name === selectedName);
  if (!skill) throw new Error(`Unknown skill: ${selectedName}. Run xata skill list to see available skills.`);
  const project = this.fs.realpathSync(this.path.resolve(this.process.cwd(), flags.directory ?? '.'));
  const agents = getAgents({
    home: this.fs.realpathSync(this.os.homedir()),
    project,
    configHome: this.env.XDG_CONFIG_HOME,
    claudeConfig: this.env.CLAUDE_CONFIG_DIR,
    codexHome: this.env.CODEX_HOME
  });
  const selected = flags.agent?.length
    ? flags.agent
    : await this.enquirer.multiselectPrompt(
        true,
        'Install for which agents?',
        agents.map((agent) => ({ name: agent.id, message: `${agent.label}${agent.detected ? ' (detected)' : ''}` })),
        agents.filter((agent) => agent.detected).map((agent) => agent.id),
        { searchable: true }
      );
  if (!selected.length) throw new Error('No agents selected.');
  const destinations = getDestinations(agents, selected, flags.global ?? false, skill.name);
  const files = await downloadSkill(registry, skill);
  const scope = flags.global ? 'user' : 'project';
  const results = await installSkills(destinations, files, {
    force: flags.force ?? false,
    approve: async (path) => {
      if (!interactive)
        throw new Error(`Existing skill differs at ${path}. Review local edits, then use --force to replace it.`);
      return Boolean(await this.enquirer.confirmPrompt(true, `Replace ${path}, discarding local edits?`));
    },
    reportPlan: (plan) => {
      if (this.outputJson) return;
      this.process.stdout.write(
        `Source: ${repository} (${registry.commit})\nScope: ${scope}${flags.global ? '' : ` (${project})`}\nMethod: copy\n`
      );
      this.printTable(
        this,
        plan,
        ['Agents', 'Destination', 'Action'],
        plan.map((item) => [item.agents.join(', '), item.path, item.status])
      );
    }
  });
  this.printTable(
    this,
    { repository, commit: registry.commit, skill: skill.name, scope, method: 'copy', results },
    ['Agents', 'Destination', 'Result'],
    results.map((item) => [item.agents.join(', '), item.path, item.status])
  );
  if (!this.outputJson)
    this.process.stdout.write(
      '\nSeparate copies can be edited independently. Shared directories may be read by other agents. Restart or reload your agent to discover installed skills.\n'
    );
};

export const SkillInstallCommand = buildCommand({
  docs: { brief: 'Install a skill; select interactively or list when no name is given' },
  parameters: {
    positional: {
      kind: 'tuple',
      parameters: [{ brief: 'Skill name from xataio/skills', placeholder: 'name', parse: String, optional: true }]
    },
    flags: {
      agent: {
        kind: 'enum',
        values: [...agentIds],
        variadic: true,
        optional: true,
        brief: 'Target agent; repeat to select multiple agents'
      },
      global: {
        kind: 'boolean',
        optional: true,
        withNegated: false,
        brief: 'Install at user scope instead of project scope'
      },
      directory: {
        kind: 'parsed',
        parse: String,
        optional: true,
        brief: 'Project root (defaults to the current directory); not the final skill directory'
      },
      force: {
        kind: 'boolean',
        optional: true,
        withNegated: false,
        brief: 'Replace differing existing skills, discarding local edits'
      }
    }
  },
  func: implementation
});
