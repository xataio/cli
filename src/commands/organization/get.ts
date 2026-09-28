import { buildCommand } from '@stricli/core';
import { Schemas } from '@xata.io/api';
import invariant from 'tiny-invariant';
import type { LocalContext } from '~/context';
import { exitWithError, getErrorMessage, printField } from '~/lib/cli-utils';

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
    exitWithError(this, getErrorMessage(error));
  }

  const organizationId = await this.getOrganization(this, flags, { organizationName });

  const organization = await this.api.organizations.getOrganization({
    pathParams: { organizationID: organizationId }
  });

  printField(this, 'organization', Object.keys(Schemas.organizationSchema.shape), organization, field);
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
