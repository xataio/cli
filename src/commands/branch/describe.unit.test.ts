import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { getBranch, print } from '~/lib/cli-utils';
import { implementation } from './describe';

const BRANCH_ID = 'oansf546nh1bf3blhj75d674gs';

const branch = {
  id: BRANCH_ID,
  name: 'main',
  createdAt: '2026-05-23T09:00:00.000Z',
  updatedAt: '2026-05-24T10:30:00.000Z',
  region: 'us-east-1',
  parentID: null,
  configuration: { instanceType: 'shared', replicas: 1, storage: 42 },
  status: { status: 'ready', statusType: 'active' },
  scaleToZero: { enabled: false, inactivityPeriodMinutes: 15 }
};

function buildContext({ storage }: { storage?: number } = { storage: 42 }) {
  const stdout: string[] = [];
  const describeBranch = mock(async () => ({
    ...branch,
    configuration: { ...branch.configuration, storage }
  }));
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

  test('shows the region, storage and updated_at it already fetched', async () => {
    const { context, stdout } = buildContext();

    await implementation.call(context, { branch: 'main', json: false });

    const table = stdout.join('');
    expect(table).toContain('region');
    expect(table).toContain('us-east-1');
    expect(table).toContain('storage');
    expect(table).toContain('42');
    expect(table).toContain('updated_at');
    expect(table).toContain('2026-05-24T10:30:00.000Z');
  });

  test('leaves storage blank when the branch does not report one', async () => {
    const { context, stdout } = buildContext({ storage: undefined });

    await implementation.call(context, { branch: 'main', json: false });

    const table = stdout.join('');
    expect(table).toContain('storage');
    expect(table).not.toContain('42');
    expect(table).toContain('us-east-1');
  });
});
