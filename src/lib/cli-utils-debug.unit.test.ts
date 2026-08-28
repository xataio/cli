/* biome-ignore-all lint/style/noProcessEnv: the point of these tests is which variable was read */

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

const CONTEXT_ENV_VARS = [
  'XATA_ORGANIZATION_ID',
  'XATA_PROJECT_ID',
  'XATA_BRANCH_ID',
  'XATA_DATABASE_NAME',
  'XATA_ORGANIZATIONID',
  'XATA_PROJECTID',
  'XATA_BRANCHID',
  'XATA_DATABASENAME'
];

const stderr: string[] = [];

function buildContext(...branches: string[]) {
  return {
    api: {
      branches: {
        listBranches: async () => {
          return { branches: branches.map((id) => ({ id })) };
        },
        describeBranch: async ({ pathParams }: { pathParams: { branchID: string } }) => {
          return { id: pathParams.branchID };
        }
      },
      projects: {
        listProjects: async () => {
          return { projects: [] };
        }
      }
    },
    debug: true,
    process: {
      stdout: { write: () => true },
      stderr: {
        write: (value: string) => {
          return stderr.push(value);
        }
      },
      exit: (code?: number) => {
        throw new Error(`exit:${code}`);
      }
    },
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

function lines() {
  return stderr.join('');
}

describe('debug source naming', () => {
  beforeEach(() => {
    projectConfig.organizationId = '';
    projectConfig.projectId = '';
    branchConfig.branchId = '';
    branchConfig.branchName = '';
    branchConfig.databaseName = '';
    stderr.length = 0;
    for (const name of CONTEXT_ENV_VARS) {
      delete process.env[name];
    }
  });

  test('names the flag a value came from', async () => {
    const context = buildContext();

    await getOrganization(context, { organization: 'org-flag' }, {});
    await getProject(context, { project: 'project-flag' }, { organizationId: 'org-flag' });
    await getBranch(context, { branch: 'branch-flag' }, { organizationId: 'org-flag', projectId: 'project-flag' });

    expect(lines()).toContain('DEBUG: organization = org-flag (from --organization)');
    expect(lines()).toContain('DEBUG: project = project-flag (from --project)');
    expect(lines()).toContain('DEBUG: branch = branch-flag (from --branch)');
  });

  // The reporter in xataio/cli#6 saw env-derived values printed and assumed they were in use.
  test('names the environment variable rather than the config file when both could apply', async () => {
    process.env.XATA_ORGANIZATION_ID = 'org-env';
    projectConfig.organizationId = 'org-env';
    const context = buildContext();

    await getOrganization(context, {}, {});

    expect(lines()).toContain('DEBUG: organization = org-env (from XATA_ORGANIZATION_ID)');
  });

  test('names the legacy environment variable when that is the one that is set', async () => {
    process.env.XATA_PROJECTID = 'project-env';
    projectConfig.projectId = 'project-env';
    const context = buildContext();

    await getProject(context, {}, { organizationId: 'org' });

    expect(lines()).toContain('DEBUG: project = project-env (from XATA_PROJECTID)');
  });

  test('names the config file when no environment variable is set', async () => {
    projectConfig.organizationId = 'org-config';
    const context = buildContext();

    await getOrganization(context, {}, {});

    expect(lines()).toContain('DEBUG: organization = org-config (from ');
    expect(lines()).toContain('project.json)');
  });

  test('names the prompt and the single remaining candidate', async () => {
    const context = buildContext('only-branch');

    await getBranch(context, {}, { organizationId: 'org', projectId: 'project' });

    expect(lines()).toContain('DEBUG: branch = only-branch (from the only branch in this project)');
  });

  test('names the default the database falls back to', async () => {
    branchConfig.databaseName = 'xata';
    const context = buildContext('only-branch');

    await resolveContext(context, { organization: 'org-flag', project: 'project-flag' });

    expect(lines()).toContain('DEBUG: database = xata (from the xata default)');
  });

  test('names the flag the database came from', async () => {
    const context = buildContext('only-branch');

    await resolveContext(context, { organization: 'org-flag', project: 'project-flag', database: 'mydb' });

    expect(lines()).toContain('DEBUG: database = mydb (from --database)');
  });

  test('covers all four values in one resolution', async () => {
    branchConfig.databaseName = 'xata';
    const context = buildContext('only-branch');

    await resolveContext(context, { organization: 'org-flag', project: 'project-flag' });

    for (const name of ['organization', 'project', 'branch', 'database']) {
      expect(lines()).toContain(`DEBUG: ${name} = `);
    }
  });

  test('says nothing about a branch it did not resolve', async () => {
    const context = buildContext();

    await getBranch(context, {}, { organizationId: 'org', projectId: 'project', skipPrompt: true });

    expect(lines()).not.toContain('DEBUG: branch');
  });

  test('writes nothing when debug is off', async () => {
    const context = { ...buildContext('only-branch'), debug: false } as LocalContext;

    await resolveContext(context, { organization: 'org-flag', project: 'project-flag' });

    expect(stderr).toHaveLength(0);
  });
});
