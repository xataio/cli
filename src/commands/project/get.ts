import { buildCommand } from '@stricli/core';
import { Schemas } from '@xata.io/api';
import invariant from 'tiny-invariant';
import type { LocalContext } from '~/context';
import { exitWithError, getErrorMessage, printField } from '~/lib/cli-utils';

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
    exitWithError(this, getErrorMessage(error));
  }

  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId, projectName });

  const project = await this.api.projects.getProject({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });

  printField(this, 'project', Object.keys(Schemas.projectSchema.shape), project, field);
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
