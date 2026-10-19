import { buildApplication, buildRouteMap, run } from '@stricli/core';
import type { Types } from '@xata.io/api';
import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { BranchCreateCommand } from './branch/create';
import { OnboardCommand } from './onboard';
import { ProjectCreateCommand } from './project/create';
import { ProjectSetCommand } from './project/set';

const app = buildApplication(
  buildRouteMap({
    docs: { brief: '' },
    routes: {
      branch: BranchCreateCommand,
      project: ProjectCreateCommand,
      set: ProjectSetCommand,
      onboard: OnboardCommand
    }
  }),
  { name: 'xata' }
);

const buildContext = (input = '') => {
  const stderr: string[] = [];
  const defaults = {
    baseBranches: { enabled: false, inactivityPeriodMinutes: 17 },
    childBranches: { enabled: true, inactivityPeriodMinutes: 43 }
  };
  const createProject = mock(async ({ body }: { body: Types.CreateProjectMutationRequest }) => ({
    id: 'project-id',
    ...body
  }));
  const updateProject = mock(async ({ body }: { body: Types.UpdateProjectMutationRequest }) => ({
    id: 'project-id',
    ...body
  }));
  const createBranch = mock(async ({ body }: { body: Types.CreateBranchMutationRequest }) => ({
    id: 'branch-id',
    ...body
  }));
  const getOrganization = mock(async () => 'org-id');
  const getOrganizationsList = mock(async () => ({ organizations: [] }));
  const process = {
    stdout: { write: mock() },
    stderr: { write: (value: string) => stderr.push(value) },
    exitCode: undefined as number | undefined,
    exit: (code: number) => {
      throw new Error(`exit:${code}`);
    }
  };
  const context = {
    process,
    isInteractive: Boolean(input),
    outputJson: true,
    getOrganization,
    getProject: async () => 'project-id',
    getActiveProfile: () => 'default',
    printDetails: mock(),
    api: {
      organizations: {
        getOrganizationsList,
        getOrganization: async () => ({ status: { usage_tier: 't1' } })
      },
      projects: {
        createProject,
        updateProject,
        getProject: async () => ({ name: 'test', configuration: { scaleToZero: defaults } }),
        listRegions: async () => ({ regions: [{ id: 'us-east-1' }] }),
        listInstanceTypes: async () => ({ instanceTypes: [{ name: 'small', vcpus: 500, ram: 2 }] }),
        listImages: async () => ({ images: [{ name: 'postgresql-17' }] }),
        getOrganizationLimits: async () => ({})
      },
      branches: { createBranch, listBranches: async () => ({ branches: [] }) }
    },
    enquirer: {
      inputPrompt: async (_interactive: boolean, _message: string, options?: { flag?: string }) =>
        options?.flag ?? input,
      selectPrompt: async (_interactive: boolean, _message: string, _choices: unknown, options?: { flag?: string }) =>
        options?.flag ?? ''
    }
  } as unknown as LocalContext;
  return {
    context,
    process,
    stderr,
    createProject,
    updateProject,
    createBranch,
    getOrganization,
    getOrganizationsList
  };
};

describe('inactivity flags reject invalid values before running commands', () => {
  test.each([
    ['branch', 'inactivity-period'],
    ['project', 'inactivity-period-base'],
    ['project', 'inactivity-period-child'],
    ['onboard', 'inactivity-period-base'],
    ['onboard', 'inactivity-period-child']
  ])('%s --%s', async (command, flag) => {
    for (const value of ['0', '1441', '-1', '1.5', '', ' ', '10min', '1e2', '0x10', '99999999999999999999']) {
      const { context, process, stderr, getOrganization, getOrganizationsList } = buildContext();

      await run(app, [command, `--${flag}`, value, ...(command === 'project' ? ['--name', 'test'] : [])], context);

      expect(process.exitCode).not.toBe(0);
      expect(stderr.join('')).toContain('whole number of minutes between 1 and 1440');
      expect(getOrganization).not.toHaveBeenCalled();
      expect(getOrganizationsList).not.toHaveBeenCalled();
    }
  });
});

describe('project inactivity periods', () => {
  test.each([
    { flags: ['--inactivity-period-base', '10', '--inactivity-period-child', '47'], base: 10, child: 47 },
    { flags: [], base: 30, child: 30 }
  ])('creates project defaults and a root branch: %j', async ({ flags, base, child }) => {
    const { context, process, stderr, createProject, createBranch } = buildContext();

    await run(
      app,
      [
        'project',
        '--name',
        'test',
        '--branch-name',
        'main',
        '--region',
        'us-east-1',
        '--replicas',
        '1',
        '--instance-type',
        'small',
        '--postgres-version',
        'postgresql-17',
        ...flags
      ],
      context
    );

    expect(stderr.join('')).toBe('');
    expect(process.exitCode).toBe(0);
    expect(createProject.mock.calls[0]?.[0].body.configuration?.scaleToZero).toEqual({
      baseBranches: { enabled: false, inactivityPeriodMinutes: base },
      childBranches: { enabled: true, inactivityPeriodMinutes: child }
    });
    expect(createBranch.mock.calls[0]?.[0].body.scaleToZero).toEqual({
      enabled: false,
      inactivityPeriodMinutes: base
    });
  });

  test.each(['base', 'child'])('sets %s without changing other defaults', async (kind) => {
    for (const prompted of [false, true]) {
      const { context, process, stderr, updateProject } = buildContext(prompted ? '10' : '');

      await run(app, ['set', `inactivity-period-${kind}`, ...(prompted ? [] : ['10'])], context);

      expect(stderr.join('')).toBe('');
      expect(process.exitCode).toBe(0);
      expect(updateProject.mock.calls[0]?.[0].body.configuration?.scaleToZero).toEqual({
        baseBranches: { enabled: false, inactivityPeriodMinutes: kind === 'base' ? 10 : 17 },
        childBranches: { enabled: true, inactivityPeriodMinutes: kind === 'child' ? 10 : 43 }
      });
    }
  });

  test.each(['base', 'child'])('rejects invalid or missing %s values without updating', async (kind) => {
    for (const value of ['0', '1441', '10min', '1.5', undefined]) {
      const { context, process, stderr, updateProject } = buildContext();

      await run(app, ['set', `inactivity-period-${kind}`, ...(value === undefined ? [] : [value])], context);

      expect(process.exitCode).not.toBe(0);
      expect(stderr.join('')).toContain(value === undefined ? 'Expected value' : 'whole number of minutes');
      expect(updateProject).not.toHaveBeenCalled();
    }
  });
});
