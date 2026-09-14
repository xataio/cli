import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { exitWithErrorDetails, getErrorMessage, printCustom } from '~/lib/cli-utils';

type Flags = {
  organization?: string;
  'invitation-id'?: string;
  force: boolean;
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

    invitationId = await this.enquirer.selectPrompt(this.isInteractive, 'Select an invitation to delete', choices);
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

  if (!flags.force) {
    const confirmed = await this.enquirer.confirmPrompt(
      this.isInteractive,
      `Are you sure you want to delete the invitation for ${invitation.email}?`
    );

    if (!confirmed) {
      return new Error('Operation cancelled');
    }
  }

  try {
    await this.api.organizations.deleteOrganizationInvitation({
      pathParams: {
        organizationID: organizationId!,
        invitationID: invitationId
      }
    });

    printCustom(
      this,
      {
        success: true,
        deletedInvitation: { id: invitation.id, email: invitation.email },
        organization: organizationId
      },
      () => {
        this.process.stdout.write(chalk.green(`✓ Successfully deleted invitation for ${invitation.email}\n`));
      }
    );
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    exitWithErrorDetails(this, `Failed to delete invitation: ${errorMessage}`, { invitationId });
  }
}

export const OrganizationInvitationsDeleteCommand = buildCommand({
  docs: {
    brief: 'Delete an invitation'
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
        brief: 'ID of the invitation to delete',
        parse: String,
        optional: true
      },
      force: {
        kind: 'boolean',
        brief: 'Skip confirmation prompt',
        default: false
      }
    }
  },
  func: implementation
});
