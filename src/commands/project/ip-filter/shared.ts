import chalk from 'chalk';
import { isValidCidr, normalizeCidr } from '@xata.io/lang';
import type { LocalContext } from '~/context';

export type IpFilteringConfig = {
  enabled: boolean;
  cidr: { cidr: string; description?: string }[];
};

export function getIpFilteringConfig(ipFiltering?: {
  enabled?: boolean;
  cidr?: { cidr: string; description?: string }[];
}): IpFilteringConfig {
  return {
    enabled: ipFiltering?.enabled ?? false,
    cidr: [...(ipFiltering?.cidr ?? []).map((e) => ({ ...e }))]
  };
}

export function printIpFilterStatus(context: LocalContext, ipFiltering: IpFilteringConfig) {
  const status = ipFiltering.enabled ? chalk.green('Enabled') : chalk.yellow('Disabled');
  context.process.stdout.write(`\nIP Filtering: ${status}\n`);

  if (ipFiltering.cidr.length === 0) {
    context.process.stdout.write(chalk.dim('  No CIDR entries configured\n'));
  } else {
    context.process.stdout.write('\n');
    for (const entry of ipFiltering.cidr) {
      const desc = entry.description ? chalk.dim(` - ${entry.description}`) : '';
      context.process.stdout.write(`  ${entry.cidr}${desc}\n`);
    }
  }
  context.process.stdout.write('\n');
}

export function normalizeIpFilterCidr(cidr: string): string {
  const trimmed = cidr.trim();
  return isValidCidr(trimmed) ? normalizeCidr(trimmed) : trimmed;
}

export async function updateIpFiltering(
  context: LocalContext,
  organizationId: string,
  projectId: string,
  ipFiltering: IpFilteringConfig
) {
  return context.api.projects.updateProject({
    pathParams: { organizationID: organizationId, projectID: projectId },
    body: { configuration: { ipFiltering } }
  });
}
