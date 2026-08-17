import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { getIpFilteringConfig, normalizeIpFilterCidr, printIpFilterStatus, updateIpFiltering } from './shared';

type Flags = {
  organization?: string;
  project?: string;
  force: boolean;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags, cidr?: string) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });

  const project = await this.api.projects.getProject({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });

  const ipFiltering = getIpFilteringConfig(project.configuration.ipFiltering);

  if (ipFiltering.cidr.length === 0) {
    this.process.stderr.write(chalk.yellow('No CIDR entries to remove\n'));
    return;
  }

  let cidrToRemove: string;

  if (cidr) {
    cidrToRemove = normalizeIpFilterCidr(cidr);
  } else {
    const choices = ipFiltering.cidr.map((entry) => ({
      name: entry.cidr,
      message: entry.description ? `${entry.cidr} - ${entry.description}` : entry.cidr
    }));
    cidrToRemove = await this.enquirer.selectPrompt(this.isInteractive, 'Select CIDR to remove', choices);
  }

  const index = ipFiltering.cidr.findIndex((e) => normalizeIpFilterCidr(e.cidr) === cidrToRemove);
  if (index === -1) {
    this.process.stderr.write(chalk.red(`CIDR ${cidrToRemove} not found\n`));
    this.process.exit(1);
  }

  const isLastEntry = ipFiltering.cidr.length === 1;
  if (isLastEntry && ipFiltering.enabled && !flags.force) {
    const confirm = await this.enquirer.confirmPrompt(
      this.isInteractive,
      'This is the last CIDR entry and IP filtering is enabled. Removing it will leave filtering enabled with no allowed IPs. Continue?'
    );
    if (!confirm) {
      return new Error(`Aborted as there was no confirmation. CIDR ${cidrToRemove} not removed.`);
    }
  }

  ipFiltering.cidr.splice(index, 1);

  const updated = await updateIpFiltering(this, organizationId, projectId, ipFiltering);

  if (flags.json) {
    this.process.stdout.write(JSON.stringify(updated, null, 2));
  } else {
    printIpFilterStatus(this, ipFiltering);
    this.process.stdout.write(chalk.green(`Successfully removed ${cidrToRemove} from project ${project.name}\n`));
  }
}

export const IpFilterRemoveCommand = buildCommand({
  docs: {
    brief: 'Remove a CIDR entry from the IP filter allow list'
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
      force: {
        kind: 'boolean',
        brief: 'Skip confirmation prompts',
        default: false
      },
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      }
    },
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'CIDR block to remove',
          placeholder: 'cidr',
          parse: String,
          optional: true
        }
      ] as const
    }
  },
  func: implementation
});
