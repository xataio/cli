import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { getErrorMessage } from '~/lib/cli-utils';

type Flags = {
  organization?: string;
  'invitation-id'?: string;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});

  let invitationId = flags['invitation-id'];

  if (!invitationId) {
    const { invitations } = await this.api.organizations.listOrganizationInvitations({
      pathParams: { organizationID: organizationId! }
    });

    if (!invitations || invitations.length === 0) {
      this.process.stderr.write(chalk.red('No invitations found for this organization\n'));
      this.process.exit(1);
    }

    const choices = invitations.map((inv) => ({
      name: inv.id,
      message: `${inv.email} (${inv.status})`
    }));

    invitationId = await this.enquirer.selectPrompt(this.isInteractive, 'Select an invitation to resend', choices);
  }

  if (!invitationId) {
    this.process.stderr.write(chalk.red('Invitation ID is required\n'));
    this.process.exit(1);
  }

  const invitation = await this.api.organizations.getOrganizationInvitation({
    pathParams: {
      organizationID: organizationId!,
      invitationID: invitationId
    }
  });

  try {
    await this.api.organizations.resendOrganizationInvitation({
      pathParams: {
        organizationID: organizationId!,
        invitationID: invitationId
      }
    });

    if (flags.json) {
      this.process.stdout.write(
        JSON.stringify({
          success: true,
          resentInvitation: {
            id: invitation.id,
            email: invitation.email
          },
          organization: organizationId
        })
      );
    } else {
      this.process.stdout.write(chalk.green(`✓ Successfully resent invitation to ${invitation.email}\n`));
    }
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    if (flags.json) {
      this.process.stderr.write(
        JSON.stringify({
          success: false,
          error: errorMessage,
          invitationId
        })
      );
    } else {
      this.process.stderr.write(chalk.red(`Failed to resend invitation: ${errorMessage}\n`));
    }
    this.process.exit(1);
  }
}

export const OrganizationInvitationsResendCommand = buildCommand({
  docs: {
    brief: 'Resend an invitation'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
      },
      'invitation-id': {
        kind: 'parsed',
        brief: 'ID of the invitation to resend',
        parse: String,
        optional: true
      },
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      }
    }
  },
  func: implementation
});
