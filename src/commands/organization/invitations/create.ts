import { buildCommand } from '@stricli/core';
import type { Types } from '@xata.io/api';
import { ORGANIZATION_ROLE_IDS } from '@xata.io/utils';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { exitWithErrorDetails, getErrorMessage, printCustom } from '~/lib/cli-utils';
import { resolveInvitationRole } from '~/lib/organization-roles';

type Flags = {
  organization?: string;
  email?: string;
  role?: Types.OrganizationRoleName;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});
  const email = await this.enquirer.inputPrompt(this.isInteractive, 'Email address to invite', { flag: flags.email });
  const role = await resolveInvitationRole(this, organizationId, flags.role);

  try {
    await this.api.organizations.createOrganizationInvitation({
      pathParams: { organizationID: organizationId },
      body: role ? { email, role } : { email }
    });

    printCustom(this, { success: true, email, role, organization: organizationId }, () => {
      this.process.stdout.write(chalk.green(`✓ Successfully sent invitation to ${email}\n`));
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    exitWithErrorDetails(this, `Failed to send invitation: ${errorMessage}`, { email });
  }
}

export const OrganizationInvitationsCreateCommand = buildCommand({
  docs: {
    brief: 'Create and send an invitation to join an organization'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
      },
      email: {
        kind: 'parsed',
        brief: 'Email address to invite',
        parse: String,
        optional: true
      },
      role: {
        kind: 'enum',
        values: ORGANIZATION_ROLE_IDS,
        brief: 'Role the new member holds once they accept',
        optional: true
      }
    }
  },
  func: implementation
});
