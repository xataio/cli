import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import {
  loadAfterOrganizationChange,
  loadAfterProjectChange,
  refreshCurrentConsoleData,
  resolveInitialConsoleState
} from './loaders';
import type { ConsoleScope } from './types';

type ApiFixture = {
  organizations?: { id: string; name: string }[];
  projects?: { id: string; name: string }[];
  branches?: { id: string; name: string }[];
  credentialsError?: boolean;
};

function buildContext(fixture: ApiFixture) {
  const describeBranch = mock(async ({ pathParams }: { pathParams: { branchID: string } }) => ({
    id: pathParams.branchID,
    name: `branch ${pathParams.branchID}`
  }));
  const getBranchCredentials = mock(async ({ pathParams }: { pathParams: { branchID: string } }) => {
    if (fixture.credentialsError) throw new Error('credentials unavailable');
    return {
      username: 'xata',
      password: 'secret',
      hostname: `${pathParams.branchID}.example.com`,
      port: 5432,
      dbname: 'xata',
      connectionString: `postgresql://xata:secret@${pathParams.branchID}.example.com/xata`
    };
  });

  const context = {
    api: {
      organizations: {
        getOrganizationsList: mock(async () => ({
          organizations: fixture.organizations ?? [{ id: 'org-1', name: 'Org One' }]
        }))
      },
      projects: {
        listProjects: mock(async () => ({ projects: fixture.projects ?? [{ id: 'project-1', name: 'Project One' }] }))
      },
      branches: {
        listBranches: mock(async () => ({ branches: fixture.branches ?? [] })),
        describeBranch,
        getBranchCredentials
      }
    }
  } as unknown as LocalContext;

  return { context, describeBranch, getBranchCredentials };
}

const projectScope: ConsoleScope = {
  kind: 'project',
  organizationId: 'org-1',
  projectId: 'project-1',
  database: 'app',
  type: 'primary'
};

describe('console loaders', () => {
  test('resolves branch scope when the project has branches', async () => {
    const { context, describeBranch, getBranchCredentials } = buildContext({
      branches: [{ id: 'branch-1', name: 'main' }]
    });

    const { scope, data } = await resolveInitialConsoleState(context, { database: 'app', type: 'primary' });

    expect(scope).toEqual({
      kind: 'branch',
      organizationId: 'org-1',
      projectId: 'project-1',
      branchId: 'branch-1',
      database: 'app',
      type: 'primary'
    });
    expect(data.branchDetail?.id).toBe('branch-1');
    expect(data.branchCredentials?.connectionString).toContain('branch-1.example.com');
    expect(describeBranch).toHaveBeenCalledTimes(1);
    expect(getBranchCredentials).toHaveBeenCalledTimes(1);
  });

  test('keeps non-connection console data available when credentials cannot be read', async () => {
    const { context } = buildContext({
      branches: [{ id: 'branch-1', name: 'main' }],
      credentialsError: true
    });

    const { scope, data } = await resolveInitialConsoleState(context, { database: 'app', type: 'primary' });

    expect(scope.kind).toBe('branch');
    expect(data.branchDetail?.id).toBe('branch-1');
    expect(data.branchCredentials).toBeUndefined();
  });

  test('resolves project scope when the project has no branches', async () => {
    const { context, describeBranch } = buildContext({ branches: [] });

    const { scope, data } = await resolveInitialConsoleState(context, { database: 'app', type: 'primary' });

    expect(scope.kind).toBe('project');
    expect(data.branches).toEqual([]);
    expect(data.branchDetail).toBeUndefined();
    expect(describeBranch).not.toHaveBeenCalled();
  });

  test('throws when an explicitly requested branch does not exist', async () => {
    const { context } = buildContext({ branches: [{ id: 'branch-1', name: 'main' }] });

    await expect(
      resolveInitialConsoleState(context, { branch: 'missing', database: 'app', type: 'primary' })
    ).rejects.toThrow('Branch not found: missing');
  });

  test('organization change lands on project scope for empty projects', async () => {
    const { context, describeBranch } = buildContext({
      projects: [{ id: 'project-2', name: 'Project Two' }],
      branches: []
    });

    const result = await loadAfterOrganizationChange(context, projectScope, 'org-2');

    expect(result.scope).toEqual({
      kind: 'project',
      organizationId: 'org-2',
      projectId: 'project-2',
      database: 'app',
      type: 'primary'
    });
    expect(result.branchDetail).toBeUndefined();
    expect(describeBranch).not.toHaveBeenCalled();
  });

  test('project change picks the first branch when available', async () => {
    const { context } = buildContext({ branches: [{ id: 'branch-9', name: 'main' }] });

    const result = await loadAfterProjectChange(context, projectScope, 'project-2');

    expect(result.scope).toEqual({
      kind: 'branch',
      organizationId: 'org-1',
      projectId: 'project-2',
      branchId: 'branch-9',
      database: 'app',
      type: 'primary'
    });
    expect(result.branchDetail?.id).toBe('branch-9');
  });

  test('refresh skips branch detail for project scope', async () => {
    const { context, describeBranch } = buildContext({ branches: [] });

    const refreshed = await refreshCurrentConsoleData(context, projectScope);

    expect(refreshed.branchDetail).toBeUndefined();
    expect(describeBranch).not.toHaveBeenCalled();
  });

  test('refresh includes branch detail for branch scope', async () => {
    const { context, describeBranch } = buildContext({ branches: [{ id: 'branch-1', name: 'main' }] });

    const refreshed = await refreshCurrentConsoleData(context, {
      ...projectScope,
      kind: 'branch',
      branchId: 'branch-1'
    });

    expect(refreshed.branchDetail?.id).toBe('branch-1');
    expect(describeBranch).toHaveBeenCalledTimes(1);
  });
});
