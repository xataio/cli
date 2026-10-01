import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';

const projectConfig: { organizationId?: string; projectId?: string } = {};
const branchConfig: { branchId?: string; databaseName?: string } = {};

const projectConfigModule = await import('~/lib/project-config');
const branchConfigModule = await import('~/lib/branch-config');

mock.module('~/lib/project-config', () => {
  return {
    ...projectConfigModule,
    projectConfig,
    getProjectConfigPath: () => '/tmp/.xata/project.json',
    hasProjectConfigFile: () => true
  };
});

mock.module('~/lib/branch-config', () => {
  return { ...branchConfigModule, branchConfig };
});

const { implementation } = await import('./status');
const { printDetails } = await import('~/lib/cli-utils');

function buildContext() {
  const stdout: string[] = [];
  const context = {
    api: {
      organizations: { getOrganization: async () => ({ name: 'Test organization' }) },
      projects: { getProject: async () => ({ id: 'project', name: 'Test project' }) },
      branches: { describeBranch: async () => ({ id: 'branch', name: 'Test branch' }) }
    },
    printDetails,
    process: { stdout: { write: (value: string) => stdout.push(value) }, stderr: { write: () => {} } }
  } as unknown as LocalContext;

  return { context, stdout };
}

describe('status with a configured database', () => {
  test.each([true, false])('includes the resolved database with outputJson=%s', async (outputJson) => {
    projectConfig.organizationId = 'org';
    projectConfig.projectId = 'project';
    branchConfig.branchId = 'branch';
    branchConfig.databaseName = 'app_reporting';
    const { context, stdout } = buildContext();

    await implementation.call({ ...context, outputJson });

    const output = stdout.join('');
    if (outputJson) {
      expect(JSON.parse(output)).toEqual({
        organization: 'Test organization',
        project: 'Test project (project)',
        branch: 'Test branch (branch)',
        database: 'app_reporting'
      });
    } else {
      expect(output).toMatch(/database\s+app_reporting/);
    }
  });
});

describe('status without a usable config', () => {
  test('reports an unconfigured folder as JSON when --json was asked for', async () => {
    projectConfig.organizationId = undefined;
    projectConfig.projectId = undefined;
    const { context, stdout } = buildContext();

    await implementation.call({ ...context, outputJson: true });

    expect(JSON.parse(stdout.join(''))).toEqual({ configured: false, reason: 'no-project-config' });
  });

  test('keeps the human guidance when --json was not asked for', async () => {
    projectConfig.organizationId = undefined;
    projectConfig.projectId = undefined;
    const { context, stdout } = buildContext();

    await implementation.call({ ...context, outputJson: false });

    expect(stdout.join('')).toContain("Couldn't find a project config");
    expect(() => JSON.parse(stdout.join(''))).toThrow();
  });

  test('reports a project with no branch checked out as JSON', async () => {
    projectConfig.organizationId = 'org';
    projectConfig.projectId = 'project';
    branchConfig.branchId = undefined;
    const { context, stdout } = buildContext();

    await implementation.call({ ...context, outputJson: true });

    expect(JSON.parse(stdout.join(''))).toEqual({
      configured: false,
      reason: 'no-branch-checked-out',
      project: 'project'
    });
  });

  test('keeps the human guidance for a project with no branch checked out', async () => {
    projectConfig.organizationId = 'org';
    projectConfig.projectId = 'project';
    branchConfig.branchId = undefined;
    const { context, stdout } = buildContext();

    await implementation.call({ ...context, outputJson: false });

    expect(stdout.join('')).toContain('No branch is checked out');
  });
});
