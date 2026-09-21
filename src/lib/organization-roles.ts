import { ApiError, type Types } from '@xata.io/api';
import { DEFAULT_INVITATION_ROLE, ORGANIZATION_ROLES } from '@xata.io/utils';
import type { LocalContext } from '~/context';
import { exitWithErrorDetails } from '~/lib/cli-utils';

const ROLES_DISABLED_MESSAGE = 'Roles are not enabled for this organization';

export async function areRolesEnabled(context: LocalContext, organizationId: string): Promise<boolean> {
  try {
    await context.api.organizations.listOrganizationRoles({ pathParams: { organizationID: organizationId } });
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return false;
    }
    throw error;
  }
}

export async function ensureRolesEnabled(context: LocalContext, organizationId: string): Promise<void> {
  if (!(await areRolesEnabled(context, organizationId))) {
    exitWithErrorDetails(context, ROLES_DISABLED_MESSAGE, { organization: organizationId });
  }
}

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
  organizationId: string,
  flag: Types.OrganizationRoleName | undefined
): Promise<Types.OrganizationRoleName | undefined> {
  if (flag) {
    await ensureRolesEnabled(context, organizationId);
    return flag;
  }
  if (!context.isInteractive || context.outputJson) {
    return undefined;
  }
  if (!(await areRolesEnabled(context, organizationId))) {
    return undefined;
  }
  return promptRole(context, 'Select a role for the new member', DEFAULT_INVITATION_ROLE);
}
