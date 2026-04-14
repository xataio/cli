import { buildCommand } from '@stricli/core';
import chalk from 'chalk';

import type { LocalContext } from '~/context';

type Flags = {
  organization?: string;
  project?: string;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });

  const project = await this.api.projects.getProject({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });
  if (!project) {
    this.process.stderr.write(chalk.red(`Project ${projectId} not found.`));
    this.process.exit(1);
  }

  this.print(
    this,
    flags.json,
    project,
    ['ID', 'Created At', 'Updated At', 'Name'],
    [[project.id, project.createdAt, project.updatedAt, project.name]]
  );
}

export const ProjectDescribeCommand = buildCommand({
  docs: {
    brief: 'Describe a project'
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
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      }
    }
  },
  func: implementation
});
