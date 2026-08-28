import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import type { BranchConfig, ProjectConfig } from './schemas';

const projectConfig: ProjectConfig = { organizationId: '', projectId: '' };
const branchConfig: BranchConfig = { branchId: '', branchName: '', databaseName: '' };

const projectConfigModule = await import('./project-config');
const branchConfigModule = await import('./branch-config');

mock.module('~/lib/project-config', () => ({ ...projectConfigModule, projectConfig }));
mock.module('~/lib/branch-config', () => ({ ...branchConfigModule, branchConfig }));

const { getBranch, getDatabase, getOrganization, getProject, resolveContext } = await import('./cli-utils');

const stderr: string[] = [];

const failingProcess = {
  stderr: {
    write: (value: string) => {
      return stderr.push(value);
    }
  },
  exit: (code?: number) => {
    throw new Error(`exit:${code}`);
  }
};

function contextWithOrganizations(...organizations: string[]) {
  return {
    api: {
      organizations: {
        getOrganizationsList: async () => {
          return { organizations: organizations.map((id) => ({ id, name: id })) };
        }
      }
    },
    process: failingProcess,
    isInteractive: false,
    enquirer: {
      selectPrompt: async () => {
        return '';
      }
    }
  } as unknown as LocalContext;
}

function contextWithProjects(...projects: string[]) {
  return {
    api: {
      projects: {
        listProjects: async () => {
          return { projects: projects.map((id) => ({ id })) };
        }
      }
    },
    process: failingProcess,
    isInteractive: false,
    enquirer: {
      selectPrompt: async () => {
        return '';
      }
    },
    getOrganization,
    getProject,
    getBranch,
    getDatabase
  } as unknown as LocalContext;
}

function contextWithBranches(...branches: string[]) {
  return {
    api: {
      branches: {
        listBranches: async () => {
          return { branches: branches.map((id) => ({ id })) };
        },
        describeBranch: async ({ pathParams }: { pathParams: { branchID: string } }) => {
          return { id: pathParams.branchID };
        }
      }
    },
    process: failingProcess,
    isInteractive: false,
    enquirer: {
      selectPrompt: async () => {
        return '';
      }
    },
    getOrganization,
    getProject,
    getBranch,
    getDatabase
  } as unknown as LocalContext;
}

describe('context resolution', () => {
  beforeEach(() => {
    projectConfig.organizationId = '';
    projectConfig.projectId = '';
    branchConfig.branchId = '';
    branchConfig.branchName = '';
    branchConfig.databaseName = '';
    stderr.length = 0;
  });

  test('flags take precedence over the configured values', async () => {
    projectConfig.organizationId = 'org-config';
    projectConfig.projectId = 'project-config';
    branchConfig.branchId = 'branch-config';
    branchConfig.databaseName = 'database-config';

    const context = contextWithBranches();

    expect(await getOrganization(context, { organization: 'org-flag' }, {})).toBe('org-flag');
    expect(await getProject(context, { project: 'project-flag' }, { organizationId: 'org-flag' })).toBe('project-flag');
    expect(
      await getBranch(context, { branch: 'branch-flag' }, { organizationId: 'org-flag', projectId: 'project-flag' })
    ).toBe('branch-flag');
    expect(await getDatabase({ database: 'database-flag' })).toBe('database-flag');
  });

  test('uses each configured value on its own', async () => {
    const context = contextWithBranches();

    projectConfig.organizationId = 'org-config';
    expect(await getOrganization(context, {}, {})).toBe('org-config');

    projectConfig.projectId = 'project-config';
    expect(await getProject(context, {}, { organizationId: 'org-config' })).toBe('project-config');

    branchConfig.branchId = 'branch-config';
    expect(await getBranch(context, {}, { organizationId: 'org-config', projectId: 'project-config' })).toBe(
      'branch-config'
    );

    branchConfig.databaseName = 'database-config';
    expect(await getDatabase({})).toBe('database-config');
  });

  test('ignores the configured project and branch when another one is targeted', async () => {
    projectConfig.organizationId = 'org-config';
    projectConfig.projectId = 'project-config';
    branchConfig.branchId = 'branch-config';

    expect(await getProject(contextWithProjects('project-a'), {}, { organizationId: 'org-flag' })).toBe('project-a');
    expect(
      await getBranch(contextWithBranches('branch-a'), {}, { organizationId: 'org-config', projectId: 'project-flag' })
    ).toBe('branch-a');
  });

  test('resolves every value of the target branch at once', async () => {
    projectConfig.organizationId = 'org-config';
    branchConfig.databaseName = 'database-config';

    expect(await resolveContext(contextWithBranches(), { project: 'project-flag', branch: 'branch-flag' })).toEqual({
      organizationId: 'org-config',
      projectId: 'project-flag',
      branchId: 'branch-flag',
      database: 'database-config'
    });
  });

  test('leaves the branch empty for commands that opt out of the prompt', async () => {
    const branch = await getBranch(
      contextWithBranches('branch-a', 'branch-b'),
      {},
      { organizationId: 'org', projectId: 'project', skipPrompt: true }
    );

    expect(branch).toBe('');
  });

  // `invariant` drops its message under NODE_ENV=production, which is how CI runs the CLI, so
  // these have to reach stderr on their own rather than ride on a thrown assertion.
  test('fails with an actionable message when no branch can be resolved', async () => {
    await expect(
      getBranch(contextWithBranches('branch-a', 'branch-b'), {}, { organizationId: 'org', projectId: 'project' })
    ).rejects.toThrow('exit:1');

    expect(stderr.join('')).toContain('No branch selected. Pass --branch <id> or set XATA_BRANCH_ID.');
    expect(stderr.join('')).toContain('branch list --organization org --project project');
  });

  test('fails with an actionable message when the project has no branches', async () => {
    await expect(getBranch(contextWithBranches(), {}, { organizationId: 'org', projectId: 'project' })).rejects.toThrow(
      'exit:1'
    );

    expect(stderr.join('')).toContain('No branches found in this project. Create one with `xata branch create`.');
  });

  test('names the organization it looked in when no project can be resolved', async () => {
    await expect(getProject(contextWithProjects('a', 'b'), {}, { organizationId: 'org-x' })).rejects.toThrow('exit:1');

    expect(stderr.join('')).toContain('No project selected. Pass --project <id> or set XATA_PROJECT_ID.');
    expect(stderr.join('')).toContain('project list --organization org-x');
  });

  test('skips the configured branch when the command asks for it', async () => {
    branchConfig.branchId = 'branch-config';

    const branch = await getBranch(
      contextWithBranches('branch-a', 'branch-b'),
      {},
      { organizationId: 'org', projectId: 'project', skipProjectConfig: true, skipPrompt: true }
    );

    expect(branch).toBe('');
  });

  test('names the account when it has no organizations at all', async () => {
    const context = contextWithOrganizations();

    await expect(getOrganization(context, {}, {})).rejects.toThrow('exit:1');

    expect(stderr.join('')).toContain('No organizations found. Create one with `xata organization create`');
  });

  test('names the organization when it has no projects at all', async () => {
    await expect(getProject(contextWithProjects(), {}, { organizationId: 'org-x' })).rejects.toThrow('exit:1');

    expect(stderr.join('')).toContain('No projects found in organization org-x.');
  });

  test('rejects a value passed as both a flag and an argument', async () => {
    const context = contextWithProjects('a');

    await expect(getOrganization(context, { organization: 'a' }, { organizationName: 'b' })).rejects.toThrow('exit:1');
    expect(stderr.join('')).toContain('Pass the organization either as --organization <id> or as an argument');

    await expect(getProject(context, { project: 'a' }, { organizationId: 'org', projectName: 'b' })).rejects.toThrow(
      'exit:1'
    );
    expect(stderr.join('')).toContain('Pass the project either as --project <id> or as an argument');
  });

  test('names an organization argument that does not match any organization', async () => {
    const context = contextWithOrganizations('org-a');

    await expect(getOrganization(context, {}, { organizationName: 'nope' })).rejects.toThrow('exit:1');

    expect(stderr.join('')).toContain('Invalid organization: nope.');
    expect(stderr.join('')).toContain('organization list');
  });

  test('names a project argument that does not match any project', async () => {
    const context = contextWithProjects('project-a');

    await expect(getProject(context, {}, { organizationId: 'org-x', projectName: 'nope' })).rejects.toThrow('exit:1');

    expect(stderr.join('')).toContain('Invalid project: nope.');
    expect(stderr.join('')).toContain('project list --organization org-x');
  });
});
