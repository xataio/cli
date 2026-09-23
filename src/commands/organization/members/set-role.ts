import { buildCommand } from '@stricli/core';
import type { Types } from '@xata.io/api';
import { ORGANIZATION_ROLE_IDS, organizationRoleLabel } from '@xata.io/utils';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { exitWithErrorDetails, getErrorMessage, printCustom } from '~/lib/cli-utils';
import { ensureRolesEnabled, promptRole } from '~/lib/organization-roles';

type Flags = {
  organization?: string;
  'user-id'?: string;
  role?: Types.OrganizationRoleName;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});
  const details = { organization: organizationId };

  const roles = await ensureRolesEnabled(this, organizationId);

  const { members } = await this.api.organizations.listOrganizationMembers({
    pathParams: { organizationID: organizationId }
  });

  if (members.length === 0) {
    return exitWithErrorDetails(this, 'No members found in this organization', details);
  }

  const userId =
    flags['user-id'] ??
    (await this.enquirer.selectPrompt(
      this.isInteractive,
      'Select a member',
      members.map((member) => ({
        name: member.id,
        message: `${member.name || '-'} (${member.email}): ${organizationRoleLabel(member.role)}`
      }))
    ));

  if (!userId) {
    return exitWithErrorDetails(this, 'User ID is required', details);
  }

  const member = members.find((candidate) => candidate.id === userId);
  if (!member) {
    return exitWithErrorDetails(this, `User with ID ${userId} is not a member of this organization`, { userId });
  }
  const memberName = member.name || member.email;

  const role = flags.role ?? (await promptRole(this, `Select a role for ${memberName}`, member.role, roles));

  if (!role) {
    return exitWithErrorDetails(this, 'Role is required', { userId });
  }

  try {
    await this.api.organizations.setOrganizationMemberRole({
      pathParams: { organizationID: organizationId, userID: member.id },
      body: { role }
    });

    printCustom(this, { success: true, userId: member.id, role, organization: organizationId }, () => {
      this.process.stdout.write(chalk.green(`✓ ${memberName} is now ${organizationRoleLabel(role)}\n`));
    });
  } catch (error) {
    exitWithErrorDetails(this, `Failed to set role: ${getErrorMessage(error)}`, { userId, role });
  }
}

export const OrganizationMembersSetRoleCommand = buildCommand({
  docs: {
    brief: 'Set the role of an organization member'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
      },
      'user-id': {
        kind: 'parsed',
        brief: 'ID of the member',
        parse: String,
        optional: true
      },
      role: {
        kind: 'enum',
        values: ORGANIZATION_ROLE_IDS,
        brief: 'Role to grant',
        optional: true
      }
    }
  },
  func: implementation
});
