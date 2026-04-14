import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { getErrorMessage } from '~/lib/cli-utils';

type Flags = {
  organization?: string;
  email?: string;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});
  const email = await this.enquirer.inputPrompt(this.isCI, 'Email address to invite', { flag: flags.email });

  try {
    await this.api.organizations.createOrganizationInvitation({
      pathParams: { organizationID: organizationId! },
      body: { email }
    });

    if (flags.json) {
      this.process.stdout.write(
        JSON.stringify({
          success: true,
          email,
          organization: organizationId
        })
      );
    } else {
      this.process.stdout.write(chalk.green(`✓ Successfully sent invitation to ${email}\n`));
    }
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    if (flags.json) {
      this.process.stderr.write(
        JSON.stringify({
          success: false,
          error: errorMessage,
          email
        })
      );
    } else {
      this.process.stderr.write(chalk.red(`Failed to send invitation: ${errorMessage}\n`));
    }
    this.process.exit(1);
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
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      }
    }
  },
  func: implementation
});
