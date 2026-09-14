import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { getIpFilteringConfig, printIpFilterStatus } from './shared';
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

  printCustom(this, ipFiltering, () => printIpFilterStatus(this, ipFiltering));
}

export const IpFilterListCommand = buildCommand({
  docs: {
    brief: 'Show IP filtering status and configured CIDR entries'
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
