import { afterEach, describe, expect, mock, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LocalContext } from '~/context';
import { print } from '~/lib/cli-utils';
import { implementation } from './scratch';

const tempPaths: string[] = [];

afterEach(() => {
  for (const tempPath of tempPaths.splice(0)) {
    fs.rmSync(tempPath, { recursive: true, force: true });
  }
});

function buildContext() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exit = mock((code?: number) => {
    throw new Error(`exit:${code}`);
  });
  const unsafe = mock(async () => [{ id: 1, name: 'hello' }]);
  const end = mock(async () => {});
  const createBranch = mock(async ({ body }: { body: { name: string } }) => ({
    id: 'scratch-branch-id',
    name: body.name,
    createdAt: '2026-06-09T00:00:00.000Z',
    parentID: 'source-branch-id',
    connectionString: 'postgresql://user:pass@localhost:5432/postgres'
  }));
  const deleteBranch = mock(async () => ({}));
  const listBranches = mock(async (): Promise<{ branches: { id: string; name: string }[] }> => ({ branches: [] }));
  const describeBranch = mock(async () => ({
    id: 'scratch-branch-id',
    name: 'scratch-branch',
    connectionString: 'postgresql://user:pass@localhost:5432/postgres',
    status: { statusType: 'STATUS_TYPE_HEALTHY', status: 'healthy' }
  }));

  const context = {
    api: {
      projects: {
        getProject: mock(async () => ({
          configuration: {
            scaleToZero: {
              childBranches: { enabled: true, inactivityPeriodMinutes: 15 }
            }
          }
        }))
      },
      branches: {
        createBranch,
        describeBranch,
        deleteBranch,
        listBranches
      }
    },
    process: {
      env: { PATH: Bun.env.PATH ?? '' },
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: (value: string) => stderr.push(value) },
      once: mock(() => {}),
      off: mock(() => {}),
      exit
    },
    fs,
    os,
    path,
    isInteractive: false,
    print,
    getOrganization: mock(async () => 'org-id'),
    getProject: mock(async () => 'project-id'),
    getBranch: mock(async () => 'source-branch-id'),
    getDatabase: mock(async () => 'app'),
    postgres: mock(() => ({ unsafe, end }))
  } as unknown as LocalContext;

  return { context, stdout, stderr, createBranch, deleteBranch, listBranches, describeBranch, unsafe, end, exit };
}

describe('scratch command', () => {
  test('creates a child branch, executes SQL, prints a table, and deletes the branch', async () => {
    const { context, stdout, stderr, createBranch, deleteBranch, unsafe, end } = buildContext();

    await implementation.call(context, { execute: 'select 1', json: false });

    expect(createBranch).toHaveBeenCalledTimes(1);
    expect(createBranch.mock.calls[0]?.[0]).toMatchObject({
      pathParams: { organizationID: 'org-id', projectID: 'project-id' },
      body: {
        mode: 'inherit',
        parentID: 'source-branch-id',
        scaleToZero: { enabled: true, inactivityPeriodMinutes: 15 }
      }
    });
    expect(createBranch.mock.calls[0]?.[0].body.name).toStartWith('scratch-');
    expect(unsafe).toHaveBeenCalledWith('select 1');
    expect(end).toHaveBeenCalledTimes(1);
    expect(deleteBranch).toHaveBeenCalledTimes(1);
    expect(stdout.join('')).toContain('id');
    expect(stdout.join('')).toContain('hello');
    expect(stderr.join('')).toContain('Created scratch branch scratch-');
    expect(stderr.join('')).toContain('Deleted scratch branch scratch-');
  });

  test('prints SQL results as JSON when --json is passed', async () => {
    const { context, stdout } = buildContext();

    await implementation.call(context, { execute: 'select 1', json: true });

    expect(JSON.parse(stdout.join(''))).toEqual([{ id: 1, name: 'hello' }]);
  });

  test('deletes the scratch branch when SQL execution fails', async () => {
    const { context, deleteBranch, unsafe } = buildContext();
    unsafe.mockImplementationOnce(async () => {
      throw new Error('query failed');
    });

    await expect(implementation.call(context, { execute: 'select broken', json: false })).rejects.toThrow(
      'query failed'
    );

    expect(deleteBranch).toHaveBeenCalledTimes(1);
  });

  test('deletes an exact-name scratch branch when create succeeds server-side but the response is lost', async () => {
    const { context, createBranch, deleteBranch, listBranches } = buildContext();
    let branchName = '';
    createBranch.mockImplementationOnce(async ({ body }: { body: { name: string } }) => {
      branchName = body.name;
      throw new Error('connection reset');
    });
    listBranches.mockImplementationOnce(async () => ({
      branches: [{ id: 'recovered-scratch-branch-id', name: branchName }]
    }));

    await expect(implementation.call(context, { execute: 'select 1', json: false })).rejects.toThrow(
      'connection reset'
    );

    expect(listBranches).toHaveBeenCalledTimes(1);
    expect(deleteBranch).toHaveBeenCalledWith({
      pathParams: { organizationID: 'org-id', projectID: 'project-id', branchID: 'recovered-scratch-branch-id' }
    });
  });

  test('does not warn about or delete unrelated scratch branches after create fails', async () => {
    const { context, createBranch, deleteBranch, listBranches, stderr } = buildContext();
    createBranch.mockImplementationOnce(async () => {
      throw new Error('create failed');
    });
    listBranches.mockImplementationOnce(async () => ({
      branches: [{ id: 'other-scratch-branch-id', name: 'scratch-other-run' }]
    }));

    await expect(implementation.call(context, { execute: 'select 1', json: false })).rejects.toThrow('create failed');

    expect(listBranches).toHaveBeenCalledTimes(1);
    expect(deleteBranch).not.toHaveBeenCalled();
    expect(stderr.join('')).not.toContain('scratch-other-run');
  });

  test('deletes the scratch branch before exiting on SIGINT', async () => {
    const { context, deleteBranch, unsafe, exit } = buildContext();
    const handlers = new Map<string, () => void>();
    const exitCodes: (number | undefined)[] = [];
    let startQuery: () => void = () => {};
    let rejectQuery: (error: Error) => void = () => {};

    (context.process.once as unknown as ReturnType<typeof mock>).mockImplementation(
      (signal: string, handler: () => void) => {
        handlers.set(signal, handler);
      }
    );
    (exit as unknown as ReturnType<typeof mock>).mockImplementation((code?: number) => {
      exitCodes.push(code);
    });
    unsafe.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectQuery = reject;
          startQuery();
        })
    );

    const queryStarted = new Promise<void>((resolve) => {
      startQuery = resolve;
    });
    const run = implementation.call(context, { execute: 'select pg_sleep(60)', json: false }).catch(() => {});

    await queryStarted;
    handlers.get('SIGINT')?.();

    for (let attempt = 0; attempt < 10 && exitCodes.length === 0; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    expect(deleteBranch).toHaveBeenCalledTimes(1);
    expect(exitCodes).toEqual([130]);

    rejectQuery(new Error('interrupted'));
    await run;
  });

  test('fails before creating a branch when the binary does not exist', async () => {
    const { context, createBranch } = buildContext();

    await expect(
      implementation.call(context, { json: false }, 'definitely-missing-xata-scratch-binary')
    ).rejects.toThrow('exit:1');

    expect(createBranch).not.toHaveBeenCalled();
  });

  test('runs binaries with postgres environment variables, deletes the branch, and preserves exit code', async () => {
    const { context, deleteBranch } = buildContext();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xata-scratch-test-'));
    tempPaths.push(tempDir);
    const binary = path.join(tempDir, 'check-env');
    fs.writeFileSync(
      binary,
      `#!/usr/bin/env bun\nif (!process.env.DATABASE_URL || !process.env.XATA_DATABASE_URL || !process.env.PGHOST || process.env.PGDATABASE !== 'app') process.exit(6);\nprocess.exit(7);\n`
    );
    fs.chmodSync(binary, 0o755);

    await expect(implementation.call(context, { json: false }, binary)).rejects.toThrow('exit:7');

    expect(deleteBranch).toHaveBeenCalledTimes(1);
  });
});
