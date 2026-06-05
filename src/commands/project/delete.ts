import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';

type Flags = {
  organization?: string;
  project?: string;

  json: boolean;
  yes: boolean;
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

  if (!flags.yes) {
    const confirmFromPrompt = await this.enquirer.confirmPrompt(
      this.isInteractive,
      `Are you sure you want to delete the project ${project.name}?`
    );
    if (!confirmFromPrompt) {
      this.process.stdout.write(`Aborted as there was no confirmation. Project not deleted.`);
      return;
    }
  }

  await this.api.projects.deleteProject({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });

  this.print(this, flags.json, project, ['project'], [[project.name]]);
}

export const ProjectDeleteCommand = buildCommand({
  docs: {
    brief: 'Delete a project'
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
      },
      yes: {
        kind: 'boolean',
        brief: 'Do not ask for confirmation, assume yes.',
        default: false
      }
    }
  },
  func: implementation
});
