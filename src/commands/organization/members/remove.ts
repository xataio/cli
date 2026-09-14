import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { exitWithErrorDetails, printCustom } from '~/lib/cli-utils';

type Flags = {
  organization?: string;
  'user-id'?: string;
  force: boolean;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});

  // Get organization members first
  const { members } = await this.api.organizations.listOrganizationMembers({
    pathParams: { organizationID: organizationId! }
  });

  if (!members || members.length === 0) {
    return exitWithErrorDetails(this, 'No members found in this organization', { organization: organizationId });
  }

  let userId = flags['user-id'];
  if (!userId) {
    // Prompt user to select a member to remove
    const choices = members.map((member) => ({
      name: member.id,
      message: `${member.name || '-'} (${member.email})`
    }));

    userId = await this.enquirer.selectPrompt(
      this.isInteractive,
      'Select a member to remove from the organization',
      choices
    );
  }

  if (!userId) {
    return exitWithErrorDetails(this, 'User ID is required', { organization: organizationId });
  }
  // Find the member to remove
  const memberToRemove = members.find((m) => m.id === userId);
  if (!memberToRemove) {
    return exitWithErrorDetails(this, `User with ID ${userId} not found in organization`, { userId });
  }

  // Confirmation prompt (unless --force is used)
  if (!flags.force) {
    const memberName = memberToRemove.name || memberToRemove.email;
    const confirmed = await this.enquirer.confirmPrompt(
      this.isInteractive,
      `Are you sure you want to remove ${memberName} from the organization?`
    );

    if (!confirmed) {
      return new Error('Operation cancelled');
    }
  }

  try {
    await this.api.organizations.removeOrganizationMember({
      pathParams: {
        organizationID: organizationId!,
        userID: userId
      }
    });

    printCustom(
      this,
      {
        success: true,
        removedUser: { id: memberToRemove.id, name: memberToRemove.name, email: memberToRemove.email },
        organization: organizationId
      },
      () => {
        const memberName = memberToRemove.name || memberToRemove.email;
        this.process.stdout.write(chalk.green(`✓ Successfully removed ${memberName} from the organization\n`));
      }
    );
  } catch (error: any) {
    exitWithErrorDetails(this, `Failed to remove member: ${error.message}`, { userId });
  }
}

export const OrganizationMembersRemoveCommand = buildCommand({
  docs: {
    brief: 'Remove a member from an organization'
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
        brief: 'ID of the user to remove',
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
