import { buildCommand } from '@stricli/core';
import chalk from 'chalk';

import type { LocalContext } from '~/context';
import { branchConfig } from '~/lib/branch-config';
import { CLI_NAME } from '~/lib/constants';
import { getProjectConfigPath, hasProjectConfigFile, projectConfig } from '~/lib/project-config';

type Flags = {
  json: boolean;
};

export async function implementation(this: LocalContext, { json }: Flags) {
  const organizationId = projectConfig.organizationId;
  const projectId = projectConfig.projectId;
  const branchId = branchConfig.branchId;

  if (!organizationId || !projectId) {
    this.process.stdout.write(`Couldn't find a project config in ${chalk.bold(getProjectConfigPath())}.\n`);
    this.process.stdout.write(`Please connect a project to a folder using ${chalk.bold(`${CLI_NAME} init`)}\n\n`);
    return;
  }

  // `init` refuses to run again once the project file exists, so pointing there would dead-end.
  if (!branchId) {
    this.process.stdout.write(`No branch is checked out, the project is ${chalk.bold(projectId)}.\n`);
    this.process.stdout.write(
      `Please check one out using ${chalk.bold(`${CLI_NAME} checkout <branch>`)} or set XATA_BRANCH_ID\n\n`
    );
    return;
  }

  const organization = await this.api.organizations.getOrganization({
    pathParams: { organizationID: organizationId }
  });

  const project = await this.api.projects.getProject({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });

  const branch = await this.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
  });

  if (!json) {
    const source = hasProjectConfigFile() ? chalk.bold(getProjectConfigPath()) : 'environment variables';
    this.process.stdout.write(`Current project config based on ${source}:\n`);
  }

  this.print(
    this,
    json,
    {
      organization: organization.name,
      project: `${project.name} (${project.id})`,
      branch: `${branch.name} (${branch.id})`
    },
    ['organization', 'project', 'branch'],
    [[organization.name, `${project.name} (${project.id})`, `${branch.name} (${branch.id})`]]
  );
}

export const StatusCommand = buildCommand({
  docs: {
    brief: 'Show the organization, project, and branch this folder uses',
    fullDescription:
      'Reads the context from the `XATA_*` variables and the local config, so it is the quickest way to see which branch the commands run here will act on.'
  },
  parameters: {
    flags: {
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      }
    }
  },
  func: implementation
});
