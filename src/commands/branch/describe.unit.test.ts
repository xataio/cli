import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { getBranch, print, printDetails } from '~/lib/cli-utils';
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
    print,
    printDetails
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

  test('puts each field on its own line, so a field can be looked up by name', async () => {
    const { context, stdout } = buildContext();

    await implementation.call(context, { branch: 'main', json: false });

    // What `awk '$1=="storage" {print $2}'` does.
    const lookup = (field: string) =>
      stdout
        .join('')
        .split('\n')
        .map((line) => line.split(/\s+/))
        .find((columns) => columns[0] === field)
        ?.slice(1)
        .join(' ');

    expect(lookup('branch_id')).toBe(BRANCH_ID);
    expect(lookup('region')).toBe('us-east-1');
    expect(lookup('storage')).toBe('42');
    expect(lookup('updated_at')).toBe('2026-05-24T10:30:00.000Z');
  });

  test('keeps a value containing spaces on one line, which a column layout cannot', async () => {
    const { context, stdout } = buildContext();
    (context.api.branches.describeBranch as unknown as ReturnType<typeof mock>).mockResolvedValue({
      ...branch,
      status: { status: 'Cluster in healthy state', statusType: 'STATUS_TYPE_HEALTHY' }
    });

    await implementation.call(context, { branch: 'main', json: false });

    const line = stdout
      .join('')
      .split('\n')
      .find((candidate) => candidate.startsWith('status '));

    expect(line?.replace(/^status\s+/, '')).toBe('Cluster in healthy state');
  });

  test('leaves no trailing whitespace on any line', async () => {
    const { context, stdout } = buildContext();

    await implementation.call(context, { branch: 'main', json: false });

    for (const line of stdout.join('').split('\n')) {
      expect(line).toBe(line.trimEnd());
    }
  });
});
