import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { exitWithErrorDetails, printCustom } from '~/lib/cli-utils';

type Flags = {
  organization?: string;
  email?: string;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});
  const email = await this.enquirer.inputPrompt(this.isInteractive, 'Email address to invite', { flag: flags.email });

  try {
    await this.api.organizations.createOrganizationInvitation({
      pathParams: { organizationID: organizationId! },
      body: { email }
    });

    printCustom(this, { success: true, email, organization: organizationId }, () => {
      this.process.stdout.write(chalk.green(`✓ Successfully sent invitation to ${email}\n`));
    });
  } catch (error: any) {
    exitWithErrorDetails(this, `Failed to send invitation: ${error.message}`, { email });
  }
}

export const OrganizationMembersInviteCommand = buildCommand({
  docs: {
    brief: 'Send an invitation to join an organization'
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
      }
    }
  },
  func: implementation
});
