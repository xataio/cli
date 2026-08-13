import { buildCommand } from '@stricli/core';
import { instanceTypeUnavailableMessage, monthlyComputeCost } from '@xata.io/utils';
import chalk from 'chalk';
import { match } from 'ts-pattern';
import type { LocalContext } from '~/context';
import { branchConfig } from '~/lib/branch-config';
import { getBranchLimits, replicaChoicesFor } from '~/lib/branch-limits';
import { CLI_NAME, DEFAULT_API_BASE_URL } from '~/lib/constants';

import type { Types } from '@xata.io/api';
import { pickLatestPostgresImage, sortPostgresImagesDesc } from '@xata.io/utils';
import invariant from 'tiny-invariant';
import type { ProjectOptions } from '~/lib/cli-utils';
import { groupAndSortRegions } from '~/lib/cli-utils';
import { isCLIConfigInitialized } from '~/lib/cli-config';
import { config } from '~/lib/config';
import { implementation as checkout } from './checkout';
import { implementation as waitReady } from './wait-ready';

type Flags = {
  organization?: string;
  project?: string;
  name?: string;
  'parent-branch'?: string;
  'no-parent': boolean;
  replicas?: string;
  'instance-type'?: string;
  region?: string;
  'postgres-version'?: string;
  'scale-to-zero'?: 'true' | 'false';
  'inactivity-period'?: '15' | '30' | '60' | '120' | '180';
  json: boolean;
};

export async function instanceTypes(context: LocalContext, organizationId: string, region: string) {
  const instanceTypes = await context.api.projects.listInstanceTypes({
    pathParams: { organizationID: organizationId },
    queryParams: { region }
  });

  return instanceTypes.instanceTypes;
}

export function shouldShowInstanceTypePricing(context: LocalContext) {
  const activeProfile = context.getActiveProfile();
  return config.profiles[activeProfile]?.customConfig?.apiBaseUrl === DEFAULT_API_BASE_URL;
}

export function buildInstanceTypeChoices(
  instances: Awaited<ReturnType<typeof instanceTypes>>,
  { showPricing, maxAllowedVCPUs }: { showPricing: boolean; maxAllowedVCPUs?: number }
) {
  return instances.map((instanceType) => {
    const parts = [`${instanceType.name} / ${instanceType.vcpus} milli-vCPU / ${instanceType.ram} GB RAM`];
    if (showPricing) {
      const instanceMonthlyCost = monthlyComputeCost(instanceType, 1);
      parts.push(chalk.gray(`$${instanceMonthlyCost.display} per mo`));
    }
    if (maxAllowedVCPUs !== undefined && instanceType.vcpus > maxAllowedVCPUs) {
      parts.push(chalk.yellow('not available on your current plan'));
    }
    return {
      name: instanceType.name,
      message: parts.join(' / ')
    };
  });
}

export async function createRootBranch(
  context: LocalContext,
  organizationId: string,
  projectId: string,
  branchName: string,
  replicas: number,
  region: string,
  instanceType: string,
  scaleToZero: boolean,
  inactivityPeriodMinutes: number,
  image: string
) {
  const configuration: Types.ClusterConfiguration = {
    replicas,
    image,
    region,
    instanceType
  };
  const branch = await context.api.branches.createBranch({
    pathParams: { organizationID: organizationId, projectID: projectId },
    body: {
      name: branchName,
      mode: 'custom',
      configuration,
      scaleToZero: {
        enabled: scaleToZero,
        inactivityPeriodMinutes
      }
    }
  });
  return branch;
}

export async function createChildBranch(
  context: LocalContext,
  organizationId: string,
  projectId: string,
  parentBranch: string,
  branchName: string,
  scaleToZero: boolean,
  inactivityPeriodMinutes: number
) {
  const branch = await context.api.branches.createBranch({
    pathParams: { organizationID: organizationId, projectID: projectId },
    body: {
      name: branchName,
      mode: 'inherit',
      parentID: parentBranch,
      scaleToZero: {
        enabled: scaleToZero,
        inactivityPeriodMinutes
      }
    }
  });
  return branch;
}

export async function getRegion(context: LocalContext, flags: { region?: string }, options: ProjectOptions) {
  const title = options?.title || 'Please select a region for the branch';
  const regions = await context.api.projects.listRegions({
    pathParams: { organizationID: options.organizationId }
  });

  if (flags.region) {
    if (!regions.regions.some((region) => flags.region === region.id)) {
      context.process.stderr.write(
        chalk.red(`Invalid region: ${flags.region}. This region is not available for this organization.`)
      );
      context.process.exit(1);
    }
    invariant(flags.region, `Region should exist`);
    return flags.region;
  }

  if (!flags.region) {
    const regionChoices = groupAndSortRegions(regions.regions);
    const region = (await context.enquirer.selectPrompt(
      context.isInteractive,
      title,
      regionChoices
    )) as Flags['region'];
    invariant(region, `Region should exist`);
    return region;
  }

  invariant(false, `Expected input for flag --region`);
}

export async function getReplicas(context: LocalContext, flags: { replicas?: string }, options: ProjectOptions) {
  const title = options?.title || 'Please select number of replicas for the branch';
  const { maxReplicas } = await getBranchLimits(context, options.organizationId);
  const choices = replicaChoicesFor(maxReplicas);

  if (flags.replicas) {
    if (!choices.some((replica) => flags.replicas === replica.name)) {
      context.process.stderr.write(
        chalk.red(`Invalid replica count: ${flags.replicas}. Must be one of: ${choices.map((r) => r.name).join(', ')}.`)
      );
      context.process.exit(1);
    }
    invariant(flags.replicas, `Replicas should exist`);
    return flags.replicas;
  }

  if (!flags.replicas) {
    const replicas = (await context.enquirer.selectPrompt(context.isInteractive, title, choices)) as Flags['replicas'];
    invariant(replicas, `Replicas should exist`);
    return replicas;
  }

  invariant(false, `Expected input for flag --region`);
}

export async function getInstanceType(
  context: LocalContext,
  flags: { 'instance-type'?: string },
  options: ProjectOptions & { region: string }
) {
  const title = options?.title || 'Please select the type of instance for this branch';
  const { maxAllowedVCPUs } = await getBranchLimits(context, options.organizationId);
  const instances = await instanceTypes(context, options.organizationId, options.region);
  const instanceChoices = buildInstanceTypeChoices(instances, {
    showPricing: shouldShowInstanceTypePricing(context),
    maxAllowedVCPUs
  });

  const instanceType =
    flags['instance-type'] ??
    ((await context.enquirer.selectPrompt(context.isInteractive, title, instanceChoices)) as Flags['instance-type']);
  invariant(instanceType, `Instance type should exist`);

  const instance = instances.find((option) => option.name === instanceType);
  if (!instance) {
    context.process.stderr.write(
      chalk.red(`Invalid instance type: ${instanceType}. This instance type is not available for this organization.`)
    );
    context.process.exit(1);
  }

  if (maxAllowedVCPUs && instance.vcpus > maxAllowedVCPUs) {
    context.process.stderr.write(chalk.red(`${instanceTypeUnavailableMessage(instanceType)}\n`));
    context.process.exit(1);
  }

  return instanceType;
}

export async function getImage(
  context: LocalContext,
  flags: { 'postgres-version'?: string },
  options: ProjectOptions & { region: string }
) {
  const title = options?.title || 'Please select the PostgreSQL version for this branch';

  try {
    const images = await context.api.projects.listImages({
      pathParams: { organizationID: options.organizationId },
      queryParams: { region: options.region }
    });

    if (!images.images || images.images.length === 0) {
      context.process.stderr.write(chalk.red('No PostgreSQL images available for this region.'));
      context.process.exit(1);
    }

    const sortedImages = sortPostgresImagesDesc(images.images);

    const imageChoices = sortedImages.map((image) => ({
      name: image.name,
      message: image.name
    }));

    if (flags['postgres-version']) {
      if (!images.images.some((image) => flags['postgres-version'] === image.name)) {
        context.process.stderr.write(
          chalk.red(
            `Invalid postgres version: ${flags['postgres-version']}. This version is not available for this region.`
          )
        );
        context.process.exit(1);
      }
      return flags['postgres-version'];
    }

    const defaultImage = pickLatestPostgresImage(sortedImages);
    const defaultIndex = defaultImage ? sortedImages.indexOf(defaultImage) : -1;
    const initial = defaultIndex >= 0 ? defaultIndex : 0;

    const image = (await context.enquirer.selectPrompt(context.isInteractive, title, imageChoices, {
      initial
    })) as string;
    invariant(image, `Postgres version should exist`);
    return image;
  } catch {
    context.process.stderr.write(
      chalk.red('Failed to fetch available PostgreSQL versions. Please specify manually with --postgres-version.')
    );
    context.process.exit(1);
  }
}

export async function implementation(this: LocalContext, flags: Flags) {
  if (flags['parent-branch'] && flags['no-parent']) {
    this.process.stderr.write(chalk.red('Cannot use --parent-branch together with --no-parent.\n'));
    this.process.exit(1);
  }

  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });

  const project = await this.api.projects.getProject({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });

  const scaleToZeroBase = project.configuration.scaleToZero.baseBranches.enabled;
  const inactivityPeriodBase = project.configuration.scaleToZero.baseBranches.inactivityPeriodMinutes;
  const scaleToZeroChild = project.configuration.scaleToZero.childBranches.enabled;
  const inactivityPeriodChild = project.configuration.scaleToZero.childBranches.inactivityPeriodMinutes;

  const branchName = await this.enquirer.inputPrompt(this.isInteractive, 'Please enter the branch name', {
    flag: flags.name
  });
  if (!branchName) {
    this.process.stderr.write(chalk.red(`Expected input for flag --name`));
    this.process.exit(1);
  }

  if (!flags['parent-branch'] && !flags['no-parent']) {
    const branches = await this.api.branches.listBranches({
      pathParams: { organizationID: organizationId, projectID: projectId }
    });
    flags['parent-branch'] = '';
    if (branches.branches.length > 0) {
      flags['parent-branch'] = await this.getBranch(this, {}, { organizationId, projectId });
    }
  }

  const parentBranchId = flags['parent-branch'] ?? '';

  // Determine if this will be a base branch (no parent)
  const isRootBranch = !parentBranchId;

  // Use project defaults unless overridden by flags
  const defaultScaleToZero = isRootBranch ? scaleToZeroBase : scaleToZeroChild;
  const defaultInactivityPeriod = isRootBranch ? inactivityPeriodBase : inactivityPeriodChild;

  const scaleToZero = flags['scale-to-zero'] ? flags['scale-to-zero'] === 'true' : defaultScaleToZero;

  const inactivityPeriodMinutes = flags['inactivity-period']
    ? parseInt(flags['inactivity-period'])
    : defaultInactivityPeriod;

  const branch = await match(Boolean(parentBranchId))
    .with(false, async () => {
      const region = await getRegion(this, flags, { organizationId });
      const replicas = await getReplicas(this, flags, { organizationId });
      const instanceType = await getInstanceType(this, flags, { organizationId, region });
      const image = await getImage(this, flags, { organizationId, region });

      return await createRootBranch(
        this,
        organizationId,
        projectId,
        branchName,
        parseInt(replicas),
        region,
        instanceType,
        scaleToZero,
        inactivityPeriodMinutes,
        image
      );
    })
    .otherwise(async () => {
      const branch = await createChildBranch(
        this,
        organizationId,
        projectId,
        parentBranchId,
        branchName,
        scaleToZero,
        inactivityPeriodMinutes
      );

      if (flags['instance-type']) {
        await waitReady.call(this, { json: true }, branchName);

        const describedBranch = await this.api.branches.describeBranch({
          pathParams: { organizationID: organizationId, projectID: projectId, branchID: branch.id }
        });

        const instanceType = await getInstanceType(this, flags, {
          organizationId,
          region: describedBranch.region
        });

        const updatedBranch = await this.api.branches.updateBranch({
          pathParams: { organizationID: organizationId, projectID: projectId, branchID: branch.id },
          body: {
            instanceType,
            scaleToZero: {
              enabled: scaleToZero,
              inactivityPeriodMinutes
            }
          }
        });

        this.process.stderr.write(chalk.green(`Updated branch instance type to ${instanceType}\n`));

        return updatedBranch;
      }

      return branch;
    });

  this.print(
    this,
    flags.json,
    branch,
    ['branch_id', 'created_at', 'name', 'parent_id'],
    [[branch.id, branch.createdAt, branch.name, branch.parentID ?? '']]
  );

  if (isCLIConfigInitialized(this)) {
    await checkout.call(
      this,
      {
        ...flags,
        branch: '',
        database: branchConfig.databaseName
      },
      branch.name
    );

    this.process.stderr.write(
      `Please run ${chalk.bold(`${CLI_NAME} branch wait-ready`)} to wait for this branch to be ready.\n`
    );
  }
}

export const BranchCreateCommand = buildCommand({
  docs: {
    brief: 'Create a new branch',
    fullDescription:
      'A branch is a running Postgres database that starts as a copy of its parent. It takes a moment to come up, so `xata branch wait-ready` is what to run before connecting to it. It is checked out afterwards when this folder already has an organization, project and branch to work from.',
    customUsage: [
      { input: '--name my-branch', brief: 'Branch the current branch' },
      { input: '--name my-branch --parent-branch <branch-id>', brief: 'Branch another branch' },
      { input: '--name my-branch --no-parent', brief: 'Create a root branch with no parent' },
      {
        input: '--name my-branch --instance-type <type> --replicas 1 --scale-to-zero true',
        brief: 'Size the branch and let it scale to zero'
      }
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
      'parent-branch': {
        kind: 'parsed',
        brief: 'Parent branch ID to fork from. Cannot be combined with --no-parent.',
        parse: String,
        optional: true
      },
      'no-parent': {
        kind: 'boolean',
        brief: 'Create a root branch with no parent, instead of forking one',
        default: false
      },
      name: {
        kind: 'parsed',
        brief: 'Branch name',
        parse: String,
        optional: true
      },
      'instance-type': {
        kind: 'parsed',
        brief: 'Instance type for the branch',
        parse: String,
        optional: true
      },
      replicas: {
        kind: 'parsed',
        parse: String,
        brief: 'Number of read replicas for the branch',
        optional: true
      },
      region: {
        kind: 'parsed',
        brief: 'Region to create the branch in',
        parse: String,
        optional: true
      },
      'postgres-version': {
        kind: 'parsed',
        brief: 'PostgreSQL version for the branch',
        parse: String,
        optional: true
      },
      'scale-to-zero': {
        kind: 'enum',
        values: ['true', 'false'],
        brief: 'Scale to zero status for the branch',
        optional: true
      },
      'inactivity-period': {
        kind: 'enum',
        values: ['15', '30', '60', '120', '180'],
        brief: 'Inactivity period in minutes for the branch',
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
