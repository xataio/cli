import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import { isValidCidr, normalizeCidr } from '@xata.io/lang';
import type { LocalContext } from '~/context';
import { getIpFilteringConfig, normalizeIpFilterCidr, printIpFilterStatus, updateIpFiltering } from './shared';

type Flags = {
  organization?: string;
  project?: string;
  label?: string;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags, cidr?: string) {
  let cidrValue = cidr;
  if (!cidrValue) {
    cidrValue = await this.enquirer.inputPrompt(
      this.isInteractive,
      'Enter IP address or CIDR block (e.g. 192.168.0.0/24 or 10.0.0.1)'
    );
  }

  if (!cidrValue?.trim()) {
    this.process.stderr.write(chalk.red('CIDR value cannot be empty\n'));
    this.process.exit(1);
  }

  const normalized = normalizeCidr(cidrValue.trim());

  if (!isValidCidr(cidrValue.trim())) {
    this.process.stderr.write(
      chalk.red(
        `Invalid CIDR format: ${cidrValue}. Expected an IP address or CIDR range, e.g. 192.168.0.0/24 or 10.0.0.1\n`
      )
    );
    this.process.exit(1);
  }

  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });

  const project = await this.api.projects.getProject({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });

  const ipFiltering = getIpFilteringConfig(project.configuration.ipFiltering);

  const existing = ipFiltering.cidr.find((e) => normalizeIpFilterCidr(e.cidr) === normalized);
  if (existing) {
    const desc = existing.description ? ` (${existing.description})` : '';
    this.process.stderr.write(chalk.red(`CIDR ${normalized} already exists${desc}\n`));
    this.process.exit(1);
  }

  let description = flags.label;
  if (description === undefined && this.isInteractive) {
    description =
      (await this.enquirer.inputPrompt(this.isInteractive, 'Description (optional, press enter to skip)')) || undefined;
  }

  ipFiltering.cidr.push({ cidr: normalized, description });

  if (!ipFiltering.enabled && this.isInteractive) {
    const enable = await this.enquirer.confirmPrompt(
      this.isInteractive,
      'IP filtering is currently disabled. Enable it now?'
    );
    if (enable) {
      ipFiltering.enabled = true;
    }
  }

  const updated = await updateIpFiltering(this, organizationId, projectId, ipFiltering);

  if (flags.json) {
    this.process.stdout.write(JSON.stringify(updated, null, 2));
  } else {
    printIpFilterStatus(this, ipFiltering);
    this.process.stdout.write(chalk.green(`Successfully added ${normalized} to project ${project.name}\n`));
  }
}

export const IpFilterAddCommand = buildCommand({
  docs: {
    brief: 'Add a CIDR entry to the IP filter allow list',
    customUsage: [
      { input: '203.0.113.4', brief: 'Allow a single address' },
      { input: '203.0.113.0/24 --label office', brief: 'Allow a range and label it' }
    ]
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
      label: {
        kind: 'parsed',
        brief: 'Label for the CIDR entry',
        parse: String,
        optional: true
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
          brief: 'IP address or CIDR block to add (e.g. 192.168.0.0/24 or 10.0.0.1)',
          placeholder: 'cidr',
          parse: String,
          optional: true
        }
      ] as const
    }
  },
  func: implementation
});
