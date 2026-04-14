import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { getIpFilteringConfig, printIpFilterStatus, updateIpFiltering } from './shared';

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

  const ipFiltering = getIpFilteringConfig(project.configuration.ipFiltering);
  ipFiltering.enabled = false;

  const updated = await updateIpFiltering(this, organizationId, projectId, ipFiltering);

  if (flags.json) {
    this.process.stdout.write(JSON.stringify(updated, null, 2));
  } else {
    printIpFilterStatus(this, ipFiltering);
    this.process.stdout.write(chalk.green(`Successfully disabled IP filtering for project ${project.name}\n`));
  }
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
