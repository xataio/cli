import type { Types } from '@xata.io/api';
import { DEFAULT_INVITATION_ROLE } from '@xata.io/utils';
import type { LocalContext } from '~/context';

export async function listRoles(
  context: LocalContext,
  organizationId: string
): Promise<readonly Types.OrganizationRole[]> {
  const { roles } = await context.api.organizations.listOrganizationRoles({
    pathParams: { organizationID: organizationId }
  });
  return roles;
}

export async function promptRole(
  context: LocalContext,
  message: string,
  initial: string,
  roles: readonly Types.OrganizationRole[]
): Promise<Types.OrganizationRoleName | undefined> {
  const indexOf = (id: string) => roles.findIndex((option) => option.id === id);
  const initialIndex = indexOf(initial);
  const role = await context.enquirer.selectPrompt(
    context.isInteractive,
    message,
    roles.map((option) => ({ name: option.id, message: `${option.name}: ${option.description}` })),
    { initial: initialIndex === -1 ? Math.max(indexOf(DEFAULT_INVITATION_ROLE), 0) : initialIndex }
  );
  return roles.find((option) => option.id === role)?.id;
}

export async function resolveInvitationRole(
  context: LocalContext,
  organizationId: string,
  flag: Types.OrganizationRoleName | undefined
): Promise<Types.OrganizationRoleName | undefined> {
  if (flag || !context.isInteractive || context.outputJson) {
    return flag;
  }
  const roles = await listRoles(context, organizationId);
  return promptRole(context, 'Select a role for the new member', DEFAULT_INVITATION_ROLE, roles);
}
