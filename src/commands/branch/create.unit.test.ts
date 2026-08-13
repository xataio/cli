import type { Types } from '@xata.io/api';
import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { print } from '~/lib/cli-utils';

mock.module('~/lib/cli-config', () => {
  return {
    isCLIConfigInitialized: () => {
      return false;
    }
  };
});

const { implementation } = await import('./create');

const BASE_FLAGS = { name: 'my-branch', json: false, 'no-parent': false };

const SIZING_FLAGS = {
  region: 'us-east-1',
  replicas: '1',
  'instance-type': 'small',
  'postgres-version': 'postgresql-17'
};

function buildContext() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const createBranch = mock(async ({ body }: { body: Types.CreateBranchMutationRequest }) => {
    return {
      id: 'new-branch-id',
      name: body.name,
      createdAt: '2026-08-13T00:00:00.000Z',
      parentID: body.mode === 'inherit' ? body.parentID : null
    };
  });
  const listBranches = mock(async () => {
    return { branches: [{ id: 'existing-branch-id', name: 'main' }] };
  });
  const getBranch = mock(async () => {
    return 'existing-branch-id';
  });
  const getOrganization = mock(async () => {
    return 'org-id';
  });

  const context = {
    api: {
      branches: { createBranch, listBranches },
      projects: {
        getProject: mock(async () => {
          return {
            configuration: {
              scaleToZero: {
                baseBranches: { enabled: false, inactivityPeriodMinutes: 15 },
                childBranches: { enabled: true, inactivityPeriodMinutes: 30 }
              }
            }
          };
        }),
        listRegions: mock(async () => {
          return { regions: [{ id: 'us-east-1' }] };
        }),
        listInstanceTypes: mock(async () => {
          return { instanceTypes: [{ name: 'small', vcpus: 500, ram: 2 }] };
        }),
        listImages: mock(async () => {
          return { images: [{ name: 'postgresql-17' }] };
        }),
        getOrganizationLimits: mock(async () => {
          throw new Error('limits unavailable');
        })
      }
    },
    process: {
      stdout: {
        write: (value: string) => {
          return stdout.push(value);
        }
      },
      stderr: {
        write: (value: string) => {
          return stderr.push(value);
        }
      },
      exit: mock((code?: number) => {
        throw new Error(`exit:${code}`);
      })
    },
    isInteractive: false,
    print,
    getActiveProfile: () => {
      return 'default';
    },
    getOrganization,
    getProject: mock(async () => {
      return 'project-id';
    }),
    getBranch,
    enquirer: {
      inputPrompt: mock(async (_interactive: boolean, _title: string, options?: { flag?: string }) => {
        return options?.flag;
      }),
      selectPrompt: mock(async () => {
        throw new Error('should not prompt');
      })
    }
  } as unknown as LocalContext;

  return { context, stderr, createBranch, listBranches, getBranch, getOrganization };
}

describe('branch create parent selection', () => {
  test('--no-parent creates a root branch without asking for a parent', async () => {
    const { context, createBranch, listBranches, getBranch } = buildContext();

    await implementation.call(context, { ...BASE_FLAGS, 'no-parent': true, ...SIZING_FLAGS });

    expect(createBranch).toHaveBeenCalledTimes(1);
    const body = createBranch.mock.calls[0]?.[0].body;
    expect(body).toEqual({
      name: 'my-branch',
      mode: 'custom',
      configuration: { replicas: 1, image: 'postgresql-17', region: 'us-east-1', instanceType: 'small' },
      scaleToZero: { enabled: false, inactivityPeriodMinutes: 15 }
    });
    expect(body).not.toHaveProperty('parentID');
    expect(listBranches).not.toHaveBeenCalled();
    expect(getBranch).not.toHaveBeenCalled();
  });

  test('--parent-branch forks the given branch id', async () => {
    const { context, createBranch, getBranch } = buildContext();

    await implementation.call(context, { ...BASE_FLAGS, 'parent-branch': 'existing-branch-id' });

    expect(createBranch).toHaveBeenCalledTimes(1);
    expect(createBranch.mock.calls[0]?.[0].body).toEqual({
      name: 'my-branch',
      mode: 'inherit',
      parentID: 'existing-branch-id',
      scaleToZero: { enabled: true, inactivityPeriodMinutes: 30 }
    });
    expect(getBranch).not.toHaveBeenCalled();
  });

  test('rejects --parent-branch and --no-parent together before calling the API', async () => {
    const { context, stderr, createBranch, getOrganization } = buildContext();

    await expect(
      implementation.call(context, { ...BASE_FLAGS, 'parent-branch': 'existing-branch-id', 'no-parent': true })
    ).rejects.toThrow('exit:1');

    expect(stderr.join('')).toContain('Cannot use --parent-branch together with --no-parent');
    expect(getOrganization).not.toHaveBeenCalled();
    expect(createBranch).not.toHaveBeenCalled();
  });

  test('treats --parent-branch None as an ordinary branch id, not a sentinel', async () => {
    const { context, createBranch } = buildContext();

    await implementation.call(context, { ...BASE_FLAGS, 'parent-branch': 'None' });

    expect(createBranch.mock.calls[0]?.[0].body).toMatchObject({
      mode: 'inherit',
      parentID: 'None'
    });
  });

  test('falls back to the parent prompt when neither flag is passed', async () => {
    const { context, createBranch, getBranch } = buildContext();

    await implementation.call(context, BASE_FLAGS);

    expect(getBranch).toHaveBeenCalledTimes(1);
    expect(createBranch.mock.calls[0]?.[0].body).toMatchObject({
      mode: 'inherit',
      parentID: 'existing-branch-id'
    });
  });
});
