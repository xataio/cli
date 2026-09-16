import type { Types } from '@xata.io/api';
import { DEFAULT_INVITATION_ROLE, ORGANIZATION_ROLES } from '@xata.io/roles';
import type { LocalContext } from '~/context';

export async function promptRole(
  context: LocalContext,
  message: string,
  initial: Types.OrganizationRoleName
): Promise<Types.OrganizationRoleName | undefined> {
  const role = await context.enquirer.selectPrompt(
    context.isInteractive,
    message,
    ORGANIZATION_ROLES.map((option) => ({ name: option.id, message: `${option.name}: ${option.description}` })),
    { initial: ORGANIZATION_ROLES.findIndex((option) => option.id === initial) }
  );
  return (role || undefined) as Types.OrganizationRoleName | undefined;
}

export async function resolveInvitationRole(
  context: LocalContext,
  flag: Types.OrganizationRoleName | undefined
): Promise<Types.OrganizationRoleName | undefined> {
  if (flag) {
    return flag;
  }
  if (!context.isInteractive || context.outputJson) {
    return undefined;
  }
  return promptRole(context, 'Select a role for the new member', DEFAULT_INVITATION_ROLE);
}
