import { ApiError, type Types } from '@xata.io/api';
import { DEFAULT_INVITATION_ROLE } from '@xata.io/utils';
import type { LocalContext } from '~/context';
import { exitWithErrorDetails } from '~/lib/cli-utils';

const ROLES_DISABLED_MESSAGE = 'Roles are not enabled for this organization';

// The API answers with the roles it grants, so the CLI never offers one it would refuse.
export async function listRoles(
  context: LocalContext,
  organizationId: string
): Promise<readonly Types.OrganizationRole[] | undefined> {
  try {
    const { roles } = await context.api.organizations.listOrganizationRoles({
      pathParams: { organizationID: organizationId }
    });
    return roles;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
}

export async function areRolesEnabled(context: LocalContext, organizationId: string): Promise<boolean> {
  return (await listRoles(context, organizationId)) !== undefined;
}

export async function ensureRolesEnabled(
  context: LocalContext,
  organizationId: string
): Promise<readonly Types.OrganizationRole[]> {
  const roles = await listRoles(context, organizationId);
  if (!roles) {
    exitWithErrorDetails(context, ROLES_DISABLED_MESSAGE, { organization: organizationId });
  }
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
  const roles = await listRoles(context, organizationId);
  if (!roles) {
    return undefined;
  }
  return promptRole(context, 'Select a role for the new member', DEFAULT_INVITATION_ROLE, roles);
}
