import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { printCustom } from '~/lib/cli-utils';

const updateProjectConfig = mock(async () => {});
const updateBranchConfig = mock(async () => {});

mock.module('~/lib/project-config', () => {
  return { updateProjectConfig };
});

mock.module('~/lib/branch-config', () => {
  return { updateBranchConfig };
});

const { implementation } = await import('./checkout');

const MAIN_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaa';
const DEV_ID = 'bbbbbbbbbbbbbbbbbbbbbbbbbb';
const names: Record<string, string> = { [MAIN_ID]: 'main', [DEV_ID]: 'dev' };

class ExitCalled extends Error {}

function buildContext({ checkedOut, target }: { checkedOut: string; target: string }) {
  const stdout: string[] = [];
  const exit = mock((_code?: number) => {
    throw new ExitCalled();
  });
  const context = {
    api: {
      branches: {
        describeBranch: mock(async ({ pathParams }: { pathParams: { branchID: string } }) => ({
          id: pathParams.branchID,
          name: names[pathParams.branchID]
        }))
      }
    },
    process: { stdout: { write: (value: string) => stdout.push(value) }, stderr: { write: () => {} }, exit },
    getOrganization: mock(async () => 'org-id'),
    getProject: mock(async () => 'project-id'),
    getCheckedOutBranch: mock(async () => checkedOut),
    getBranch: mock(async () => target),
    getDatabase: mock(async () => 'xata'),
    printCustom,
    printDetails: mock(() => {})
  } as unknown as LocalContext;

  return { context, stdout, exit };
}

async function run(context: LocalContext, branchName?: string) {
  try {
    await implementation.call(context, {}, branchName);
  } catch (error) {
    if (!(error instanceof ExitCalled)) throw error;
  }
}

describe('branch checkout of the branch already checked out', () => {
  test('names the branch in JSON when it was given by ID', async () => {
    const { context, stdout, exit } = buildContext({ checkedOut: MAIN_ID, target: MAIN_ID });

    await run({ ...context, outputJson: true }, MAIN_ID);

    expect(JSON.parse(stdout.join(''))).toEqual({ id: MAIN_ID, name: 'main' });
    expect(exit).toHaveBeenCalledWith(0);
  });

  test('names the branch in JSON when it came from --branch or the prompt', async () => {
    const { context, stdout } = buildContext({ checkedOut: MAIN_ID, target: MAIN_ID });

    await run({ ...context, outputJson: true });

    expect(JSON.parse(stdout.join(''))).toEqual({ id: MAIN_ID, name: 'main' });
  });

  test('names the branch in the human output', async () => {
    const { context, stdout } = buildContext({ checkedOut: MAIN_ID, target: MAIN_ID });

    await run({ ...context, outputJson: false }, MAIN_ID);

    expect(stdout.join('')).toBe('Already on branch main\n');
  });

  test('checks out a different branch without taking the early exit', async () => {
    updateBranchConfig.mockClear();
    const { context, exit } = buildContext({ checkedOut: MAIN_ID, target: DEV_ID });

    await run({ ...context, outputJson: false }, 'dev');

    expect(exit).not.toHaveBeenCalled();
    expect(updateBranchConfig).toHaveBeenCalledWith({ branchId: DEV_ID, branchName: 'dev', databaseName: 'xata' });
  });
});
