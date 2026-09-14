import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { getIpFilteringConfig, printIpFilterStatus, updateIpFiltering } from './shared';
import { printCustom } from '~/lib/cli-utils';

type Flags = {
  organization?: string;
  project?: string;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });

  const project = await this.api.projects.getProject({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });

  const ipFiltering = getIpFilteringConfig(project.configuration.ipFiltering);
  ipFiltering.enabled = false;

  const updated = await updateIpFiltering(this, organizationId, projectId, ipFiltering);

  printCustom(this, updated, () => {
    printIpFilterStatus(this, ipFiltering);
    this.process.stdout.write(chalk.green(`Successfully disabled IP filtering for project ${project.name}\n`));
  });
}

export const IpFilterDisableCommand = buildCommand({
  docs: {
    brief: 'Disable IP filtering for a project'
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
    }
  },
  func: implementation
});
