import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import invariant from 'tiny-invariant';
import type { LocalContext } from '~/context';
import { getErrorMessage } from '~/lib/cli-utils';
import { CLI_NAME } from '~/lib/constants';

type Flags = {
  organization?: string;
  project?: string;
};

export function parseArguments(args: string[]) {
  // Handle both patterns: "field" and "projectName field"
  if (args.length >= 3) {
    throw new Error('Too many arguments. Usage: xata project get [project] field');
  }

  let projectName: string | undefined;
  let field: string = '.catalog';
  if (args.length === 1) {
    invariant(args[0], 'Field argument is required.');
    field = args[0];
  } else if (args.length === 2) {
    invariant(args[0], 'Project argument is required.');
    invariant(args[1], 'Field argument is required.');
    projectName = args[0];
    field = args[1];
  }
  if (!projectName) {
    return { field };
  }
  return { projectName, field };
}

export async function implementation(this: LocalContext, flags: Flags, ...args: string[]) {
  let projectName: string | undefined;
  let field: string;
  try {
    ({ projectName, field } = parseArguments(args));
  } catch (error) {
    this.process.stderr.write(chalk.red(getErrorMessage(error)));
    this.process.exit(1);
  }

  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId, projectName });

  const branch = await this.api.projects.getProject({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });

  const possibleFields = Object.keys(branch);
  if (field === '.catalog') {
    this.process.stdout.write(`Usage ${chalk.bold.italic(`${CLI_NAME} project get <field>`)}\n\n`);
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
    this.process.stdout.write(value);
  }
}

export const ProjectGetCommand = buildCommand({
  docs: {
    brief: 'Get a field from a project description'
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
      }
    },
    positional: {
      kind: 'array',
      parameter: {
        brief: 'Project name and/or field to get',
        parse: String,
        placeholder: '[project] field'
      }
    }
  },
  func: implementation
});
