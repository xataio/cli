import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { getBranch, print } from '~/lib/cli-utils';
import { implementation } from './describe';

const BRANCH_ID = 'oansf546nh1bf3blhj75d674gs';

const branch = {
  id: BRANCH_ID,
  name: 'main',
  createdAt: '2026-05-23T09:00:00.000Z',
  parentID: null,
  configuration: { instanceType: 'shared', replicas: 1 },
  status: { status: 'ready', statusType: 'active' },
  scaleToZero: { enabled: false, inactivityPeriodMinutes: 15 }
};

function buildContext() {
  const stdout: string[] = [];
  const describeBranch = mock(async () => branch);
  const listBranches = mock(async () => ({ branches: [{ id: BRANCH_ID, name: 'main' }] }));

  const context = {
    api: { branches: { describeBranch, listBranches } },
    process: { stdout: { write: (value: string) => stdout.push(value) } },
    isInteractive: false,
    getOrganization: mock(async () => 'org-id'),
    getProject: mock(async () => 'project-id'),
    getBranch,
    print
  } as unknown as LocalContext;

  return { context, stdout, describeBranch };
}

describe('branch describe', () => {
  test('describes the branch named by the --branch flag', async () => {
    const { context, stdout, describeBranch } = buildContext();

    await implementation.call(context, { branch: 'main', json: true });

    expect(describeBranch).toHaveBeenCalledWith({
      pathParams: { organizationID: 'org-id', projectID: 'project-id', branchID: BRANCH_ID }
    });
    expect(stdout.join('')).toContain(BRANCH_ID);
  });
});
