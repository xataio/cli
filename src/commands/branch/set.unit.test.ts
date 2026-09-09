import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { branchDescriptionMaxLength } from '@xata.io/utils';
import { print } from '~/lib/cli-utils';
import { implementation } from './set';

const FLAGS = { json: false };

function buildContext({ description }: { description?: string } = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const updateBranch = mock(async ({ body }: { body: Record<string, unknown> }) => {
    return { id: 'branch-id', ...body };
  });

  const context = {
    api: {
      branches: {
        updateBranch,
        describeBranch: mock(async () => {
          return {
            id: 'branch-id',
            name: 'my-branch',
            description,
            region: 'us-east-1',
            parentID: null,
            configuration: { instanceType: 'small', replicas: 1, storage: 10, image: 'postgresql-17' },
            scaleToZero: { enabled: false, inactivityPeriodMinutes: 15 }
          };
        })
      },
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
        listInstanceTypes: mock(async () => {
          return { instanceTypes: [{ name: 'small', vcpus: 500, ram: 2 }] };
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
    getOrganization: mock(async () => 'org-id'),
    getProject: mock(async () => 'project-id'),
    getBranch: mock(async () => 'branch-id'),
    enquirer: {
      inputPrompt: mock(async () => {
        throw new Error('should not prompt');
      }),
      selectPrompt: mock(async () => {
        throw new Error('should not prompt');
      })
    }
  } as unknown as LocalContext;

  return { context, stdout, stderr, updateBranch };
}

describe('branch set description', () => {
  test('updates the description', async () => {
    const { context, stdout, updateBranch } = buildContext();

    await implementation.call(context, FLAGS, 'description', 'Nightly import');

    expect(updateBranch).toHaveBeenCalledTimes(1);
    expect(updateBranch.mock.calls[0]?.[0].body).toEqual({ description: 'Nightly import' });
    expect(stdout.join('')).toContain('Successfully updated description to Nightly import');
  });

  test('offers description in the field catalog', async () => {
    const { context, stdout } = buildContext();

    await implementation.call(context, FLAGS, '.catalog');

    expect(stdout.join('')).toContain('- description');
  });

  test('rejects a description longer than the schema allows without calling the API', async () => {
    const { context, stderr, updateBranch } = buildContext();

    await expect(
      implementation.call(context, FLAGS, 'description', 'a'.repeat(branchDescriptionMaxLength + 1))
    ).rejects.toThrow('exit:1');

    expect(stderr.join('')).toContain(`cannot exceed ${branchDescriptionMaxLength} characters`);
    expect(updateBranch).not.toHaveBeenCalled();
  });

  test('rejects a description the API charset would refuse', async () => {
    const { context, stderr, updateBranch } = buildContext();

    await expect(implementation.call(context, FLAGS, 'description', 'no*stars')).rejects.toThrow('exit:1');

    expect(stderr.join('')).toContain('separators');
    expect(updateBranch).not.toHaveBeenCalled();
  });

  test('sets a label path, which the API charset allows', async () => {
    const { context, updateBranch } = buildContext();

    await implementation.call(context, FLAGS, 'description', 'company/infra/managed-by-x');

    expect(updateBranch.mock.calls[0]?.[0].body).toEqual({ description: 'company/infra/managed-by-x' });
  });

  test('clears the description when given an empty string', async () => {
    const { context, updateBranch } = buildContext({ description: 'Nightly import' });

    await implementation.call(context, FLAGS, 'description', '');

    expect(updateBranch.mock.calls[0]?.[0].body).toEqual({ description: '' });
  });
});
