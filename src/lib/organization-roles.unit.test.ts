import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { listRoles, resolveInvitationRole } from './organization-roles';

type Options = {
  isInteractive?: boolean;
  outputJson?: boolean;
  promptedRole?: string;
};

function buildContext({ isInteractive = false, outputJson = false, promptedRole }: Options = {}) {
  const selectPrompt = mock(
    async (_isInteractive: boolean, _message: string, _choices: unknown[], _options?: unknown) => promptedRole ?? ''
  );
  const listOrganizationRoles = mock(async () => ({
    roles: [
      { id: 'admin', name: 'Admin', description: 'Full access' },
      { id: 'editor', name: 'Editor', description: 'Create and change projects' }
    ]
  }));

  const context = {
    api: { organizations: { listOrganizationRoles } },
    isInteractive,
    outputJson,
    enquirer: { selectPrompt }
  } as unknown as LocalContext;

  return { context, selectPrompt, listOrganizationRoles };
}

describe('listRoles', () => {
  test('returns the roles the organization offers', async () => {
    const { context, listOrganizationRoles } = buildContext();

    expect(await listRoles(context, 'org-id')).toHaveLength(2);
    expect(listOrganizationRoles).toHaveBeenCalledWith({ pathParams: { organizationID: 'org-id' } });
  });
});

describe('resolveInvitationRole', () => {
  test('returns the role given with --role', async () => {
    const { context, selectPrompt, listOrganizationRoles } = buildContext({ isInteractive: true });

    expect(await resolveInvitationRole(context, 'org-id', 'editor')).toBe('editor');
    expect(selectPrompt).not.toHaveBeenCalled();
    expect(listOrganizationRoles).not.toHaveBeenCalled();
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

  test('prompts in a terminal with Admin and Editor, starting on Editor', async () => {
    const { context, selectPrompt } = buildContext({ isInteractive: true, promptedRole: 'admin' });

    expect(await resolveInvitationRole(context, 'org-id', undefined)).toBe('admin');
    expect(selectPrompt.mock.calls[0]?.[2]).toEqual([
      { name: 'admin', message: expect.stringContaining('Admin') },
      { name: 'editor', message: expect.stringContaining('Editor') }
    ]);
    expect(selectPrompt.mock.calls[0]?.[3]).toEqual({ initial: 1 });
  });
});
