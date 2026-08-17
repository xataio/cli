import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';

type Flags = {
  organization?: string;
  'user-id'?: string;
  json: boolean;
  force: boolean;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});

  // Get organization members first
  const { members } = await this.api.organizations.listOrganizationMembers({
    pathParams: { organizationID: organizationId! }
  });

  if (!members || members.length === 0) {
    this.process.stderr.write(chalk.red('No members found in this organization\n'));
    this.process.exit(1);
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
    this.process.stderr.write(chalk.red('User ID is required\n'));
    this.process.exit(1);
  }
  // Find the member to remove
  const memberToRemove = members.find((m) => m.id === userId);
  if (!memberToRemove) {
    this.process.stderr.write(chalk.red(`User with ID ${userId} not found in organization\n`));
    this.process.exit(1);
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

    if (flags.json) {
      this.process.stdout.write(
        JSON.stringify({
          success: true,
          removedUser: {
            id: memberToRemove.id,
            name: memberToRemove.name,
            email: memberToRemove.email
          },
          organization: organizationId
        })
      );
    } else {
      const memberName = memberToRemove.name || memberToRemove.email;
      this.process.stdout.write(chalk.green(`✓ Successfully removed ${memberName} from the organization\n`));
    }
  } catch (error: any) {
    if (flags.json) {
      this.process.stdout.write(
        JSON.stringify({
          success: false,
          error: error.message,
          userId
        })
      );
    } else {
      this.process.stderr.write(chalk.red(`Failed to remove member: ${error.message}\n`));
    }
    this.process.exit(1);
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
