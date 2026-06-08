import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import invariant from 'tiny-invariant';
import type { LocalContext } from '~/context';
import { getErrorMessage } from '~/lib/cli-utils';
import { CLI_NAME } from '~/lib/constants';

type Flags = {
  organization?: string;
};

export function parseArguments(args: string[]) {
  // Handle both patterns: "field" and "organizationName field"
  if (args.length >= 3) {
    throw new Error('Too many arguments. Usage: xata organization get [organization] field');
  }

  let organizationName: string | undefined;
  let field: string = '.catalog';
  if (args.length === 1) {
    invariant(args[0], 'Field argument is required.');
    field = args[0];
  } else if (args.length === 2) {
    invariant(args[0], 'Organization argument is required.');
    invariant(args[1], 'Field argument is required.');
    organizationName = args[0];
    field = args[1];
  }
  if (!organizationName) {
    return { field };
  }
  return { organizationName, field };
}

export async function implementation(this: LocalContext, flags: Flags, ...args: string[]) {
  let organizationName: string | undefined;
  let field: string;
  try {
    ({ organizationName, field } = parseArguments(args));
  } catch (error) {
    this.process.stderr.write(chalk.red(getErrorMessage(error)));
    this.process.exit(1);
  }

  const organizationId = await this.getOrganization(this, flags, { organizationName });

  const organization = await this.api.organizations.getOrganization({
    pathParams: { organizationID: organizationId }
  });

  const possibleFields = Object.keys(organization);
  if (field === '.catalog') {
    this.process.stdout.write(`Usage ${chalk.bold.italic(`${CLI_NAME} organization get <field>`)}\n\n`);
    this.process.stdout.write(`The following fields are available:\n\n`);
    this.process.stdout.write(possibleFields.map((field) => `- ${field}`).join('\n'));
    return;
  }

  if (!possibleFields.includes(field)) {
    this.process.stderr.write(chalk.red(`Invalid field: ${field}`));
    this.process.exit(1);
  }

  const value = organization[field as keyof typeof organization];
  if (!value) {
    this.process.stdout.write('');
  } else if (typeof value === 'object') {
    this.process.stdout.write(JSON.stringify(value, null, 2));
  } else {
    this.process.stdout.write(value);
  }
}

export const OrganizationGetCommand = buildCommand({
  docs: {
    brief: 'Get a field from an organization description'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
      }
    },
    positional: {
      kind: 'array',
      parameter: {
        brief: 'Organization name and/or field to get',
        parse: String,
        placeholder: '[organization] field'
      }
    }
  },
  func: implementation
});
