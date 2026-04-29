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

    invitationId = await this.enquirer.selectPrompt(this.isInteractive, 'Select an invitation to view', choices);
  }

  if (!invitationId) {
    this.process.stderr.write(chalk.red('Invitation ID is required\n'));
    this.process.exit(1);
  }

  try {
    const invitation = await this.api.organizations.getOrganizationInvitation({
      pathParams: {
        organizationID: organizationId!,
        invitationID: invitationId
      }
    });

    if (flags.json) {
      this.process.stdout.write(JSON.stringify(invitation, null, 2));
    } else {
      this.process.stdout.write(chalk.bold('\nInvitation Details:\n\n'));
      this.process.stdout.write(`${chalk.gray('ID:')}            ${invitation.id}\n`);
      this.process.stdout.write(`${chalk.gray('Email:')}         ${invitation.email}\n`);

      const name = [invitation.first_name, invitation.last_name].filter(Boolean).join(' ');
      if (name) {
        this.process.stdout.write(`${chalk.gray('Name:')}          ${name}\n`);
      }

      this.process.stdout.write(
        `${chalk.gray('Status:')}        ${invitation.status === 'pending' ? chalk.yellow(invitation.status) : chalk.red(invitation.status)}\n`
      );
      this.process.stdout.write(
        `${chalk.gray('Created:')}       ${new Date(invitation.created_at).toLocaleString()}\n`
      );
      this.process.stdout.write(
        `${chalk.gray('Expires:')}       ${new Date(invitation.expires_at).toLocaleString()}\n`
      );

      if (invitation.invite_link) {
        this.process.stdout.write(`${chalk.gray('Invite Link:')}  ${invitation.invite_link}\n`);
      }

      this.process.stdout.write('\n');
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
      this.process.stderr.write(chalk.red(`Failed to get invitation: ${errorMessage}\n`));
    }
    this.process.exit(1);
  }
}

export const OrganizationInvitationsGetCommand = buildCommand({
  docs: {
    brief: 'Get details of a specific invitation'
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
        brief: 'ID of the invitation to view',
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
