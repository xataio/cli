import { ApiError, NetworkError, type Types } from '@xata.io/api';
import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { branchDescriptionMaxLength } from '@xata.io/utils';
import { print, printDetails } from '~/lib/cli-utils';

mock.module('~/lib/project-config', () => {
  return {
    hasProjectContext: () => {
      return false;
    }
  };
});

const { implementation, getParentBranchId, promptForParentBranchId } = await import('./create');

const PARENT_ID = 'oansf546nh1bf3blhj75d674gs';

const BASE_FLAGS = { name: 'my-branch', json: false, 'no-parent': false };

const SIZING_FLAGS = {
  region: 'us-east-1',
  replicas: '1',
  'instance-type': 'small',
  'postgres-version': 'postgresql-17'
};

const options = { organizationId: 'org-id', projectId: 'project-id' };

function notFound() {
  return new ApiError(404, { message: `Branch with ID [main]: not found` }, `Branch with ID [main]: not found`);
}

function buildContext({
  maxStorageGBPerBranch,
  usageTier = 't1'
}: {
  maxStorageGBPerBranch?: number;
  usageTier?: 't1' | 't2';
} = {}) {
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
    return { branches: [{ id: PARENT_ID, name: 'main' }] };
  });
  // Every branch flag now resolves before use, so an id that is not in the list is described.
  const describeBranch = mock(async ({ pathParams }: { pathParams: { branchID: string } }) => {
    return { id: pathParams.branchID };
  });
  const getBranch = mock(async () => {
    return PARENT_ID;
  });
  const getOrganization = mock(async () => {
    return 'org-id';
  });
  const getOrganizationDetails = mock(async () => {
    return { status: { usage_tier: usageTier } };
  });

  const context = {
    api: {
      branches: { createBranch, listBranches, describeBranch },
      organizations: { getOrganization: getOrganizationDetails },
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
          if (maxStorageGBPerBranch === undefined) {
            throw new Error('limits unavailable');
          }
          return { maxStorageGBPerBranch };
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
    printDetails,
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

  return {
    context,
    stderr,
    createBranch,
    listBranches,
    describeBranch,
    getBranch,
    getOrganization,
    getOrganizationLimits: context.api.projects.getOrganizationLimits
  };
}

function buildResolverContext({
  describeBranch,
  branches = []
}: {
  describeBranch: () => Promise<{ id: string }>;
  branches?: { id: string; name: string }[];
}) {
  const stderr: string[] = [];
  const exit = mock((code?: number) => {
    throw new Error(`exit:${code}`);
  });
  const describeBranchMock = mock(describeBranch);
  const listBranches = mock(async () => ({ branches }));

  const context = {
    api: {
      branches: {
        describeBranch: describeBranchMock,
        listBranches
      }
    },
    process: {
      stderr: { write: (value: string) => stderr.push(value) },
      exit
    },
    isInteractive: false,
    getBranch: mock(async () => 'prompted-branch-id')
  } as unknown as LocalContext;

  return { context, stderr, exit, describeBranch: describeBranchMock, listBranches };
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

    await implementation.call(context, { ...BASE_FLAGS, 'parent-branch': PARENT_ID });

    expect(createBranch).toHaveBeenCalledTimes(1);
    expect(createBranch.mock.calls[0]?.[0].body).toEqual({
      name: 'my-branch',
      mode: 'inherit',
      parentID: PARENT_ID,
      scaleToZero: { enabled: true, inactivityPeriodMinutes: 30 }
    });
    expect(getBranch).not.toHaveBeenCalled();
  });

  test('--parent-branch forks the given branch name', async () => {
    const { context, createBranch, describeBranch } = buildContext();

    await implementation.call(context, { ...BASE_FLAGS, 'parent-branch': 'main' });

    expect(createBranch.mock.calls[0]?.[0].body).toMatchObject({
      mode: 'inherit',
      parentID: PARENT_ID
    });
    expect(describeBranch).not.toHaveBeenCalled();
  });

  test('rejects --parent-branch and --no-parent together before calling the API', async () => {
    const { context, stderr, createBranch, getOrganization } = buildContext();

    await expect(
      implementation.call(context, { ...BASE_FLAGS, 'parent-branch': PARENT_ID, 'no-parent': true })
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
      parentID: PARENT_ID
    });
  });
});

describe('getParentBranchId', () => {
  test('resolves a branch ID without looking up the branch list', async () => {
    const { context, describeBranch, listBranches } = buildResolverContext({
      describeBranch: async () => ({ id: PARENT_ID })
    });

    expect(await getParentBranchId(context, PARENT_ID, options)).toBe(PARENT_ID);
    expect(describeBranch).toHaveBeenCalledTimes(1);
    expect(listBranches).not.toHaveBeenCalled();
  });

  test('resolves a branch name without describing it as an ID first', async () => {
    const { context, describeBranch, listBranches } = buildResolverContext({
      describeBranch: async () => {
        throw notFound();
      },
      branches: [
        { id: 'other-branch-id', name: 'staging' },
        { id: PARENT_ID, name: 'main' }
      ]
    });

    expect(await getParentBranchId(context, 'main', options)).toBe(PARENT_ID);
    expect(listBranches).toHaveBeenCalledTimes(1);
    expect(describeBranch).not.toHaveBeenCalled();
  });

  test('reports both an ID and a name are missing when nothing matches', async () => {
    const { context, stderr, exit } = buildResolverContext({
      describeBranch: async () => {
        throw notFound();
      },
      branches: [{ id: 'other-branch-id', name: 'staging' }]
    });

    await expect(getParentBranchId(context, 'nope', options)).rejects.toThrow('exit:1');
    expect(exit).toHaveBeenCalledWith(1);
    expect(stderr.join('')).toContain('No branch in this project has that ID or name');
  });

  test('rethrows an API failure that is not a 404 instead of falling back to the name', async () => {
    const { context, listBranches } = buildResolverContext({
      describeBranch: async () => {
        throw new ApiError(500, undefined, 'Internal server error');
      },
      branches: [{ id: PARENT_ID, name: 'main' }]
    });

    await expect(getParentBranchId(context, PARENT_ID, options)).rejects.toThrow('Internal server error');
    expect(listBranches).not.toHaveBeenCalled();
  });

  test('rethrows a network failure instead of falling back to the name', async () => {
    const { context, listBranches } = buildResolverContext({
      describeBranch: async () => {
        throw new NetworkError('fetch failed');
      },
      branches: [{ id: PARENT_ID, name: 'main' }]
    });

    await expect(getParentBranchId(context, PARENT_ID, options)).rejects.toThrow('fetch failed');
    expect(listBranches).not.toHaveBeenCalled();
  });
});

describe('promptForParentBranchId', () => {
  test('creates a branch without a parent when the project has no branches', async () => {
    const { context } = buildResolverContext({
      describeBranch: async () => ({ id: PARENT_ID })
    });

    expect(await promptForParentBranchId(context, options)).toBe('');
  });

  test('asks which branch to fork when the project already has branches', async () => {
    const { context } = buildResolverContext({
      describeBranch: async () => ({ id: PARENT_ID }),
      branches: [{ id: PARENT_ID, name: 'main' }]
    });

    expect(await promptForParentBranchId(context, options)).toBe('prompted-branch-id');
  });
});

describe('branch create descriptions', () => {
  test('sends the description when creating a root branch', async () => {
    const { context, createBranch } = buildContext();

    await implementation.call(context, {
      ...BASE_FLAGS,
      'no-parent': true,
      ...SIZING_FLAGS,
      description: 'Nightly import'
    });

    expect(createBranch.mock.calls[0]?.[0].body).toMatchObject({ description: 'Nightly import' });
  });

  test('sends the description when forking a branch', async () => {
    const { context, createBranch } = buildContext();

    await implementation.call(context, { ...BASE_FLAGS, 'parent-branch': PARENT_ID, description: 'Nightly import' });

    expect(createBranch.mock.calls[0]?.[0].body).toMatchObject({ description: 'Nightly import' });
  });

  test('omits the description when the flag is not passed', async () => {
    const { context, createBranch } = buildContext();

    await implementation.call(context, { ...BASE_FLAGS, 'parent-branch': PARENT_ID });

    expect(createBranch.mock.calls[0]?.[0].body.description).toBeUndefined();
  });

  test('rejects a description longer than the schema allows without calling the API', async () => {
    const { context, stderr, createBranch } = buildContext();

    await expect(
      implementation.call(context, {
        ...BASE_FLAGS,
        'parent-branch': PARENT_ID,
        description: 'a'.repeat(branchDescriptionMaxLength + 1)
      })
    ).rejects.toThrow('exit:1');

    expect(stderr.join('')).toContain(`cannot exceed ${branchDescriptionMaxLength} characters`);
    expect(createBranch).not.toHaveBeenCalled();
  });

  test('rejects a description the API charset would refuse', async () => {
    const { context, stderr, createBranch } = buildContext();

    await expect(
      implementation.call(context, { ...BASE_FLAGS, 'parent-branch': PARENT_ID, description: 'no*stars' })
    ).rejects.toThrow('exit:1');

    expect(stderr.join('')).toContain('separators');
    expect(createBranch).not.toHaveBeenCalled();
  });

  test('sends a label path, which the API charset allows', async () => {
    const { context, createBranch } = buildContext();

    await implementation.call(context, {
      ...BASE_FLAGS,
      'parent-branch': PARENT_ID,
      description: 'company/infra/managed-by-x'
    });

    expect(createBranch.mock.calls[0]?.[0].body).toMatchObject({ description: 'company/infra/managed-by-x' });
  });
});

describe('branch create limits', () => {
  test('asks the API for the organization limits only once per command', async () => {
    const { context, getOrganizationLimits } = buildContext({ maxStorageGBPerBranch: 100 });

    await implementation.call(context, {
      ...BASE_FLAGS,
      'no-parent': true,
      ...SIZING_FLAGS,
      description: 'Nightly import',
      storage: '10'
    });

    expect(getOrganizationLimits).toHaveBeenCalledTimes(1);
  });
});

describe('branch create storage', () => {
  test('sends the storage size in the configuration of a root branch', async () => {
    const { context, createBranch } = buildContext();

    await implementation.call(context, { ...BASE_FLAGS, 'no-parent': true, ...SIZING_FLAGS, storage: '10' });

    expect(createBranch.mock.calls[0]?.[0].body).toEqual({
      name: 'my-branch',
      mode: 'custom',
      configuration: {
        replicas: 1,
        image: 'postgresql-17',
        region: 'us-east-1',
        instanceType: 'small',
        storage: 10
      },
      scaleToZero: { enabled: false, inactivityPeriodMinutes: 15 }
    });
  });

  test('omits the storage size when the flag is not passed', async () => {
    const { context, createBranch } = buildContext();

    await implementation.call(context, { ...BASE_FLAGS, 'no-parent': true, ...SIZING_FLAGS });

    expect(createBranch.mock.calls[0]?.[0].body).toEqual({
      name: 'my-branch',
      mode: 'custom',
      configuration: { replicas: 1, image: 'postgresql-17', region: 'us-east-1', instanceType: 'small' },
      scaleToZero: { enabled: false, inactivityPeriodMinutes: 15 }
    });
  });

  test('rejects --storage with --parent-branch before calling the API', async () => {
    const { context, stderr, createBranch, getOrganization } = buildContext();

    await expect(
      implementation.call(context, { ...BASE_FLAGS, 'parent-branch': PARENT_ID, storage: '10' })
    ).rejects.toThrow('exit:1');

    expect(stderr.join('')).toContain('Storage can only be set when creating a root branch');
    expect(getOrganization).not.toHaveBeenCalled();
    expect(createBranch).not.toHaveBeenCalled();
  });

  test('rejects --storage when a parent branch comes from the prompt', async () => {
    const { context, stderr, createBranch } = buildContext();

    await expect(implementation.call(context, { ...BASE_FLAGS, storage: '10' })).rejects.toThrow('exit:1');

    expect(stderr.join('')).toContain('Storage can only be set when creating a root branch');
    expect(createBranch).not.toHaveBeenCalled();
  });

  test('rejects storage that is not a whole number without calling the API', async () => {
    const { context, stderr, createBranch } = buildContext();

    await expect(
      implementation.call(context, { ...BASE_FLAGS, 'no-parent': true, ...SIZING_FLAGS, storage: '10.5' })
    ).rejects.toThrow('exit:1');

    expect(stderr.join('')).toContain('Storage must be a whole number of GB');
    expect(createBranch).not.toHaveBeenCalled();
  });

  test('rejects storage below 1 GB without calling the API', async () => {
    const { context, stderr, createBranch } = buildContext();

    await expect(
      implementation.call(context, { ...BASE_FLAGS, 'no-parent': true, ...SIZING_FLAGS, storage: '0' })
    ).rejects.toThrow('exit:1');

    expect(stderr.join('')).toContain('Storage must be a whole number of GB');
    expect(createBranch).not.toHaveBeenCalled();
  });

  test('rejects storage above the limit the organization reports', async () => {
    const { context, stderr, createBranch } = buildContext({ maxStorageGBPerBranch: 20 });

    await expect(
      implementation.call(context, { ...BASE_FLAGS, 'no-parent': true, ...SIZING_FLAGS, storage: '50' })
    ).rejects.toThrow('exit:1');

    expect(stderr.join('')).toContain('Storage cannot exceed 20 GB on your current plan');
    expect(stderr.join('')).toContain('add a payment method');
    expect(createBranch).not.toHaveBeenCalled();
  });

  test('drops the billing hint when the organization already has a payment method', async () => {
    const { context, stderr } = buildContext({ maxStorageGBPerBranch: 20, usageTier: 't2' });

    await expect(
      implementation.call(context, { ...BASE_FLAGS, 'no-parent': true, ...SIZING_FLAGS, storage: '50' })
    ).rejects.toThrow('exit:1');

    expect(stderr.join('')).toContain('please contact support');
    expect(stderr.join('')).not.toContain('add a payment method');
  });

  test('accepts storage at exactly the limit the organization reports', async () => {
    const { context, createBranch } = buildContext({ maxStorageGBPerBranch: 20 });

    await implementation.call(context, { ...BASE_FLAGS, 'no-parent': true, ...SIZING_FLAGS, storage: '20' });

    expect(createBranch.mock.calls[0]?.[0].body).toMatchObject({ configuration: { storage: 20 } });
  });
});
