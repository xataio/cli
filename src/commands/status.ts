import { buildCommand } from '@stricli/core';
import chalk from 'chalk';

import type { LocalContext } from '~/context';
import { branchConfig } from '~/lib/branch-config';
import { CLI_NAME } from '~/lib/constants';
import { getProjectConfigPath, hasProjectConfigFile, projectConfig } from '~/lib/project-config';
import { printCustom } from '~/lib/cli-utils';

export async function implementation(this: LocalContext) {
  const organizationId = projectConfig.organizationId;
  const projectId = projectConfig.projectId;
  const branchId = branchConfig.branchId;

  if (!organizationId || !projectId) {
    printCustom(this, { configured: false, reason: 'no-project-config' }, () => {
      this.process.stdout.write(`Couldn't find a project config in ${chalk.bold(getProjectConfigPath())}.\n`);
      this.process.stdout.write(`Please connect a project to a folder using ${chalk.bold(`${CLI_NAME} init`)}\n\n`);
    });
    return;
  }

  // `init` refuses to run again once the project file exists, so pointing there would dead-end.
  if (!branchId) {
    printCustom(this, { configured: false, reason: 'no-branch-checked-out', project: projectId }, () => {
      this.process.stdout.write(`No branch is checked out, the project is ${chalk.bold(projectId)}.\n`);
      this.process.stdout.write(
        `Please check one out using ${chalk.bold(`${CLI_NAME} checkout <branch>`)} or set XATA_BRANCH_ID\n\n`
      );
    });
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

  if (!this.outputJson) {
    const source = hasProjectConfigFile() ? chalk.bold(getProjectConfigPath()) : 'environment variables';
    this.process.stdout.write(`Current project config based on ${source}:\n`);
  }

  const status = {
    organization: organization.name,
    project: `${project.name} (${project.id})`,
    branch: `${branch.name} (${branch.id})`
  };

  this.printDetails(this, status, [
    ['organization', status.organization],
    ['project', status.project],
    ['branch', status.branch]
  ]);
}

export const StatusCommand = buildCommand({
  docs: {
    brief: 'Show the organization, project, and branch this folder uses',
    fullDescription:
      'Reads the context from the `XATA_*` variables and the local config, so it is the quickest way to see which branch the commands run here will act on.'
  },
  parameters: {
    flags: {}
  },
  func: implementation
});
