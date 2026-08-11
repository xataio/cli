import { buildCommand } from '@stricli/core';
import chalk from 'chalk';

import type { LocalContext } from '~/context';
import { branchConfig } from '~/lib/branch-config';
import { isCLIConfigInitialized } from '~/lib/cli-config';
import { CLI_NAME } from '~/lib/constants';
import { getProjectConfigPath, projectConfig } from '~/lib/project-config';

type Flags = {
  json: boolean;
};

export async function implementation(this: LocalContext, { json }: Flags) {
  if (isCLIConfigInitialized(this)) {
    const organizationId = projectConfig.organizationId;
    const projectId = projectConfig.projectId;
    const branchId = branchConfig.branchId;
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
      this.process.stdout.write(`Current project config based on ${chalk.bold(getProjectConfigPath())}:\n`);
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
  } else {
    this.process.stdout.write(`${`Couldn't find a project config in ${chalk.bold(getProjectConfigPath())}.`}\n`);
    this.process.stdout.write(`Please connect a project to a folder using ${chalk.bold(`${CLI_NAME} init`)}\n\n`);
  }
}

export const StatusCommand = buildCommand({
  docs: {
    brief: 'Show the organization, project, and branch this folder uses',
    fullDescription:
      'Resolves the context the way every other command does, from flags, XATA_* variables and the local config, so it is the quickest way to see which branch commands will act on.'
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
