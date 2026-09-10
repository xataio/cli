import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';

const projectConfig: { organizationId?: string; projectId?: string } = {};
const branchConfig: { branchId?: string } = {};

mock.module('~/lib/project-config', () => {
  return {
    projectConfig,
    getProjectConfigPath: () => '/tmp/.xata/project.json',
    hasProjectConfigFile: () => true
  };
});

mock.module('~/lib/branch-config', () => {
  return { branchConfig };
});

const { implementation } = await import('./status');

function buildContext() {
  const stdout: string[] = [];
  const context = {
    process: { stdout: { write: (value: string) => stdout.push(value) }, stderr: { write: () => {} } }
  } as unknown as LocalContext;

  return { context, stdout };
}

describe('status without a usable config', () => {
  test('reports an unconfigured folder as JSON when --json was asked for', async () => {
    projectConfig.organizationId = undefined;
    projectConfig.projectId = undefined;
    const { context, stdout } = buildContext();

    await implementation.call(context, { json: true });

    expect(JSON.parse(stdout.join(''))).toEqual({ configured: false, reason: 'no-project-config' });
  });

  test('keeps the human guidance when --json was not asked for', async () => {
    projectConfig.organizationId = undefined;
    projectConfig.projectId = undefined;
    const { context, stdout } = buildContext();

    await implementation.call(context, { json: false });

    expect(stdout.join('')).toContain("Couldn't find a project config");
    expect(() => JSON.parse(stdout.join(''))).toThrow();
  });

  test('reports a project with no branch checked out as JSON', async () => {
    projectConfig.organizationId = 'org';
    projectConfig.projectId = 'project';
    branchConfig.branchId = undefined;
    const { context, stdout } = buildContext();

    await implementation.call(context, { json: true });

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

    await implementation.call(context, { json: false });

    expect(stdout.join('')).toContain('No branch is checked out');
  });
});
