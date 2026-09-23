import { describe, expect, mock, test } from 'bun:test';
import { ApiError } from '@xata.io/api';
import type { LocalContext } from '~/context';
import { areRolesEnabled, resolveInvitationRole } from './organization-roles';

class ExitCalled extends Error {}

type Options = {
  isInteractive?: boolean;
  outputJson?: boolean;
  promptedRole?: string;
  rolesError?: ApiError;
};

function buildContext({ isInteractive = false, outputJson = false, promptedRole, rolesError }: Options = {}) {
  const stderr: string[] = [];
  const selectPrompt = mock(
    async (_isInteractive: boolean, _message: string, _choices: unknown[], _options?: unknown) => promptedRole ?? ''
  );
  const listOrganizationRoles = mock(async () => {
    if (rolesError) {
      throw rolesError;
    }
    return { roles: [] };
  });

  const context = {
    api: { organizations: { listOrganizationRoles } },
    process: {
      stdout: { write: () => true },
      stderr: { write: (value: string) => stderr.push(value) },
      exit: mock(() => {
        throw new ExitCalled();
      })
    },
    isInteractive,
    outputJson,
    enquirer: { selectPrompt }
  } as unknown as LocalContext;

  return { context, selectPrompt, listOrganizationRoles, stderr };
}

const rolesDisabled = () => new ApiError(404, {}, 'roles are not enabled for this organization');

describe('areRolesEnabled', () => {
  test('is true when the organization lists its roles', async () => {
    const { context, listOrganizationRoles } = buildContext();

    expect(await areRolesEnabled(context, 'org-id')).toBe(true);
    expect(listOrganizationRoles).toHaveBeenCalledWith({ pathParams: { organizationID: 'org-id' } });
  });

  test('is false when listing roles returns 404', async () => {
    const { context } = buildContext({ rolesError: rolesDisabled() });

    expect(await areRolesEnabled(context, 'org-id')).toBe(false);
  });

  test('rethrows other errors', async () => {
    const { context } = buildContext({ rolesError: new ApiError(403, {}, 'Forbidden') });

    await expect(areRolesEnabled(context, 'org-id')).rejects.toThrow('Forbidden');
  });
});

describe('resolveInvitationRole', () => {
  test('returns the role given with --role', async () => {
    const { context, selectPrompt } = buildContext({ isInteractive: true });

    expect(await resolveInvitationRole(context, 'org-id', 'editor')).toBe('editor');
    expect(selectPrompt).not.toHaveBeenCalled();
  });

  test('rejects --role when roles are disabled', async () => {
    const { context, stderr } = buildContext({ outputJson: true, rolesError: rolesDisabled() });

    await expect(resolveInvitationRole(context, 'org-id', 'editor')).rejects.toBeInstanceOf(ExitCalled);
    expect(JSON.parse(stderr.join(''))).toEqual({
      success: false,
      error: 'Roles are not enabled for this organization',
      organization: 'org-id'
    });
  });

  test('omits the role when it cannot prompt, without checking roles', async () => {
    const { context, selectPrompt, listOrganizationRoles } = buildContext();

    expect(await resolveInvitationRole(context, 'org-id', undefined)).toBeUndefined();
    expect(selectPrompt).not.toHaveBeenCalled();
    expect(listOrganizationRoles).not.toHaveBeenCalled();
  });

  test('omits the role with --json even in a terminal', async () => {
    const { context, selectPrompt } = buildContext({ isInteractive: true, outputJson: true });

    expect(await resolveInvitationRole(context, 'org-id', undefined)).toBeUndefined();
    expect(selectPrompt).not.toHaveBeenCalled();
  });

  test('prompts in a terminal, starting on Editor', async () => {
    const { context, selectPrompt } = buildContext({ isInteractive: true, promptedRole: 'admin' });

    expect(await resolveInvitationRole(context, 'org-id', undefined)).toBe('admin');
    expect(selectPrompt.mock.calls[0]?.[2]).toHaveLength(2);
    expect(selectPrompt.mock.calls[0]?.[3]).toEqual({ initial: 1 });
  });

  test('skips the prompt in a terminal when roles are disabled', async () => {
    const { context, selectPrompt } = buildContext({ isInteractive: true, rolesError: rolesDisabled() });

    expect(await resolveInvitationRole(context, 'org-id', undefined)).toBeUndefined();
    expect(selectPrompt).not.toHaveBeenCalled();
  });
});
