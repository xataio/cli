import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import invariant from 'tiny-invariant';
import type { LocalContext } from '~/context';
import { getErrorMessage } from '~/lib/cli-utils';
import { CLI_NAME } from '~/lib/constants';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
};

export function parseArguments(args: string[]) {
  // Handle both patterns: "field" and "branchName field"
  if (args.length >= 3) {
    throw new Error('Too many arguments. Usage: xata branch get [branch] field');
  }

  let branchName: string | undefined;
  let field: string = '.catalog';
  if (args.length === 1) {
    invariant(args[0], 'Field argument is required.');
    field = args[0];
  } else if (args.length === 2) {
    invariant(args[0], 'Branch argument is required.');
    invariant(args[1], 'Field argument is required.');
    branchName = args[0];
    field = args[1];
  }
  if (!branchName) {
    return { field };
  }
  return { branchName, field };
}

export async function implementation(this: LocalContext, flags: Flags, ...args: string[]) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });

  let branchName: string | undefined;
  let field: string;
  try {
    ({ branchName, field } = parseArguments(args));
  } catch (error) {
    this.process.stderr.write(chalk.red(getErrorMessage(error)));
    this.process.exit(1);
  }
  const branchId = await this.getBranch(this, flags, { organizationId, projectId, branchName });

  const branch = await this.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
  });

  const possibleFields = Object.keys(branch);
  if (field === '.catalog') {
    this.process.stdout.write(`Usage ${chalk.bold.italic(`${CLI_NAME} branch get <field>`)}\n\n`);
    this.process.stdout.write(`The following fields are available:\n\n`);
    this.process.stdout.write(possibleFields.map((field) => `- ${field}`).join('\n'));
    return;
  }

  if (!possibleFields.includes(field)) {
    this.process.stderr.write(chalk.red(`Invalid field: ${field}`));
    this.process.exit(1);
  }

  const value = branch[field as keyof typeof branch];
  if (!value) {
    this.process.stdout.write('');
  } else if (typeof value === 'object') {
    this.process.stdout.write(JSON.stringify(value, null, 2));
  } else {
    this.process.stdout.write(value.toString());
  }
}

export const BranchGetCommand = buildCommand({
  docs: {
    brief: 'Get a field from a branch description'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
      },
      project: {
        kind: 'parsed',
        brief: 'Project ID',
        parse: String,
        optional: true
      },
      branch: {
        kind: 'parsed',
        brief: 'Branch ID',
        parse: String,
        optional: true
      }
    },
    positional: {
      kind: 'array',
      parameter: {
        brief: 'Branch name and/or field to get',
        parse: String,
        placeholder: '[branch] field'
      }
    }
  },
  func: implementation
});
