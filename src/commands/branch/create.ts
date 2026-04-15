import { buildCommand } from '@stricli/core';
import { monthlyComputeCost } from '@xata.io/utils';
import chalk from 'chalk';
import { match } from 'ts-pattern';
import type { LocalContext } from '~/context';
import { branchConfig } from '~/lib/branch-config';
import { CLI_NAME } from '~/lib/constants';

import type { Types } from '@xata.io/api';
import { sortPostgresImagesDesc } from '@xata.io/utils';
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
  replicas?: '0' | '1' | '2' | '3' | '4';
  'instance-type'?: string;
  region?: string;
  'postgres-version'?: string;
  'scale-to-zero'?: 'true' | 'false';
  'inactivity-period'?: '15' | '30' | '60' | '120' | '180';
  json: boolean;
};

export const replicaChoices = [
  { name: '0', message: '0' },
  { name: '1', message: '1' },
  { name: '2', message: '2' },
  { name: '3', message: '3' },
  { name: '4', message: '4' }
];

export async function instanceTypes(context: LocalContext, organizationId: string, region: string) {
  const instanceTypes = await context.api.projects.listInstanceTypes({
    pathParams: { organizationID: organizationId },
    queryParams: { region }
  });

  return instanceTypes.instanceTypes;
}

export function shouldShowInstanceTypePricing(context: LocalContext) {
  const activeProfile = context.getActiveProfile();
  const environment = config.profiles[activeProfile]?.environment;
  return environment === 'prod' || environment === 'staging';
}

export function buildInstanceTypeChoices(
  instances: Awaited<ReturnType<typeof instanceTypes>>,
  { showPricing }: { showPricing: boolean }
) {
  return instances.map((instanceType) => {
    const parts = [`${instanceType.name} / ${instanceType.vcpus} milli-vCPU / ${instanceType.ram} GB RAM`];
    if (showPricing) {
      const instanceMonthlyCost = monthlyComputeCost(instanceType, 1);
      parts.push(chalk.gray(`$${instanceMonthlyCost.display} per mo`));
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
    const region = (await context.enquirer.selectPrompt(context.isCI, title, regionChoices)) as Flags['region'];
    invariant(region, `Region should exist`);
    return region;
  }

  invariant(false, `Expected input for flag --region`);
}

export async function getReplicas(context: LocalContext, flags: { replicas?: string }, options: ProjectOptions) {
  const title = options?.title || 'Please select number of replicas for the branch';

  if (flags.replicas) {
    if (!replicaChoices.some((replica) => flags.replicas === replica.name)) {
      context.process.stderr.write(
        chalk.red(
          `Invalid replica count: ${flags.replicas}. Must be one of: ${replicaChoices.map((r) => r.name).join(', ')}.`
        )
      );
      context.process.exit(1);
    }
    invariant(flags.replicas, `Replicas should exist`);
    return flags.replicas;
  }

  if (!flags.replicas) {
    const replicas = (await context.enquirer.selectPrompt(context.isCI, title, replicaChoices)) as Flags['replicas'];
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
  const instances = await instanceTypes(context, options.organizationId, options.region);
  const instanceChoices = buildInstanceTypeChoices(instances, { showPricing: shouldShowInstanceTypePricing(context) });

  if (flags['instance-type']) {
    if (!instances.some((instance) => flags['instance-type'] === instance.name)) {
      context.process.stderr.write(
        chalk.red(
          `Invalid instance type: ${flags['instance-type']}. This instance type is not available for this organization.`
        )
      );
      context.process.exit(1);
    }
    invariant(flags['instance-type'], `Instance type should exist`);
    return flags['instance-type'];
  }

  if (!flags['instance-type']) {
    const instanceType = (await context.enquirer.selectPrompt(
      context.isCI,
      title,
      instanceChoices
    )) as Flags['instance-type'];
    invariant(instanceType, `Instance type should exist`);
    return instanceType;
  }

  invariant(false, `Expected input for flag --instance-type`);
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

    const defaultIndex = sortedImages.findIndex((image) => image.name === 'postgres:18.3');
    const initial = defaultIndex >= 0 ? defaultIndex : 0;

    const image = (await context.enquirer.selectPrompt(context.isCI, title, imageChoices, { initial })) as string;
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
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });

  const project = await this.api.projects.getProject({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });

  const scaleToZeroBase = project.configuration.scaleToZero.baseBranches.enabled;
  const inactivityPeriodBase = project.configuration.scaleToZero.baseBranches.inactivityPeriodMinutes;
  const scaleToZeroChild = project.configuration.scaleToZero.childBranches.enabled;
  const inactivityPeriodChild = project.configuration.scaleToZero.childBranches.inactivityPeriodMinutes;

  const branchName = await this.enquirer.inputPrompt(this.isCI, 'Please enter the branch name', { flag: flags.name });
  if (!branchName) {
    this.process.stderr.write(chalk.red(`Expected input for flag --name`));
    this.process.exit(1);
  }

  if (!flags['parent-branch']) {
    flags['parent-branch'] = await this.getBranch(this, {}, { organizationId, projectId });
  }

  const parentBranchId = flags['parent-branch'];

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
    ['ID', 'Created At', 'Name', 'Parent ID'],
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
    brief: 'Create a new branch'
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
        brief: 'Parent branch ID. Pass "None" to create a branch without a parent.',
        parse: String,
        optional: true
      },
      name: {
        kind: 'parsed',
        brief: 'Branch name',
        parse: String,
        optional: true
      },
      'instance-type': {
        kind: 'parsed',
        brief: 'Please select the type of instance for this branch',
        parse: String,
        optional: true
      },
      replicas: {
        kind: 'enum',
        values: ['0', '1', '2', '3', '4'],
        brief: 'Please select number of replicas for the branch',
        optional: true
      },
      region: {
        kind: 'parsed',
        brief: 'Please select a region for the branch',
        parse: String,
        optional: true
      },
      'postgres-version': {
        kind: 'parsed',
        brief: 'Please select the PostgreSQL version for this branch',
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
