import { buildCommand } from '@stricli/core';
import {
  filterUpgradeablePostgresImages,
  instanceTypeUnavailableMessage,
  sortPostgresImagesDesc
} from '@xata.io/utils';
import chalk from 'chalk';
import { match } from 'ts-pattern';
import type { LocalContext } from '~/context';
import { CLI_NAME } from '~/lib/constants';
import { getBranchLimits, replicaChoicesFor } from '~/lib/branch-limits';
import { buildInstanceTypeChoices, instanceTypes, shouldShowInstanceTypePricing } from './create';
import { validScaleToZeroValues, validInactivityPeriodValues, scaleToZeroChoices, timeChoices } from '~/lib/config';

function storageLimitMessage(maxStorage: number, hasPaymentMethod: boolean): string {
  const action = hasPaymentMethod
    ? 'contact support'
    : 'add a payment method in your billing settings or contact support';
  return `Storage cannot exceed ${maxStorage} GB on your current plan; please ${action} to increase the limit.`;
}

// A valid payment method on file moves the org to usage tier t2, so the tier doubles as a
// "has payment method" signal. Defaults to false (offer the billing hint) if the lookup fails.
async function hasPaymentMethod(context: LocalContext, organizationId: string): Promise<boolean> {
  try {
    const organization = await context.api.organizations.getOrganization({
      pathParams: { organizationID: organizationId }
    });
    return organization.status.usage_tier === 't2';
  } catch {
    return false;
  }
}

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  json: boolean;
};

type Field =
  | 'name'
  | 'replicas'
  | 'instance-type'
  | 'storage'
  | 'hibernate'
  | 'scale-to-zero'
  | 'inactivity-period'
  | 'postgres-version';
type FieldArg = Field | '.catalog';

export async function implementation(this: LocalContext, flags: Flags, fieldArg: string, value?: string) {
  const field = fieldArg as FieldArg;
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId });

  const validFields: Field[] = [
    'name',
    'replicas',
    'instance-type',
    'storage',
    'hibernate',
    'scale-to-zero',
    'inactivity-period',
    'postgres-version'
  ];
  const excludedFields: Field[] = [];

  if (field === '.catalog') {
    this.process.stdout.write(`Usage ${chalk.bold.italic(`${CLI_NAME} branch set <field> <value>`)}\n\n`);
    this.process.stdout.write(`The following fields are available:\n\n`);
    this.process.stdout.write(
      validFields
        .filter((field) => !excludedFields.includes(field))
        .map((field) => `- ${field}`)
        .join('\n')
    );
    return;
  }

  if (!validFields.includes(field)) {
    this.process.stderr.write(chalk.red(`Invalid field: ${field}. Valid fields are: ${validFields.join(', ')}`));
    this.process.exit(1);
  }

  const branch = await this.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
  });
  const branchRegion = branch.region;

  const project = await this.api.projects.getProject({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });

  const scaleToZeroBase = project.configuration.scaleToZero.baseBranches.enabled;
  const inactivityPeriodBase = project.configuration.scaleToZero.baseBranches.inactivityPeriodMinutes;
  const scaleToZeroChild = project.configuration.scaleToZero.childBranches.enabled;
  const inactivityPeriodChild = project.configuration.scaleToZero.childBranches.inactivityPeriodMinutes;

  // Determine if this is a root branch (no parentID means it's a root branch)
  const isRootBranch = !branch.parentID;

  // Use appropriate defaults based on branch type
  const defaultScaleToZero = isRootBranch ? scaleToZeroBase : scaleToZeroChild;
  const defaultInactivityPeriod = isRootBranch ? inactivityPeriodBase : inactivityPeriodChild;

  const { maxReplicas, maxAllowedVCPUs, maxStorage } = await getBranchLimits(this, organizationId);
  const replicaChoices = replicaChoicesFor(maxReplicas);
  const instances = await instanceTypes(this, organizationId, branchRegion);
  const instanceChoices = buildInstanceTypeChoices(instances, {
    showPricing: shouldShowInstanceTypePricing(this),
    maxAllowedVCPUs
  });

  let upgradeableImageChoices: { name: string; message: string }[] = [];
  if (field === 'postgres-version') {
    const currentImage = branch.configuration.image;
    if (!currentImage) {
      this.process.stderr.write(chalk.red('Cannot determine current PostgreSQL version for this branch.\n'));
      this.process.exit(1);
    }

    const images = await this.api.projects.listImages({
      pathParams: { organizationID: organizationId },
      queryParams: { region: branchRegion }
    });

    const upgradeable = sortPostgresImagesDesc(filterUpgradeablePostgresImages(images.images ?? [], currentImage));

    if (upgradeable.length === 0) {
      this.process.stderr.write(
        chalk.red(`No new compatible PostgreSQL version available for current image ${currentImage}.\n`)
      );
      this.process.exit(1);
    }

    upgradeableImageChoices = upgradeable.map((image) => ({
      name: image.name,
      message: image.name
    }));
  }

  if (!value) {
    value = await match(field)
      .with('name', async () => {
        return await this.enquirer.inputPrompt(this.isInteractive, 'Please enter the new branch name');
      })
      .with('replicas', async () => {
        return await this.enquirer.selectPrompt(
          this.isInteractive,
          'Please select number of replicas for the branch',
          replicaChoices
        );
      })
      .with('instance-type', async () => {
        return await this.enquirer.selectPrompt(
          this.isInteractive,
          'Please select the type of instance for this branch',
          instanceChoices
        );
      })
      .with('storage', async () => {
        const current = branch.configuration.storage;
        const suffix = current !== undefined ? ` (current: ${current} GB)` : '';
        return await this.enquirer.inputPrompt(this.isInteractive, `Please enter the new storage size in GB${suffix}`);
      })
      .with('hibernate', async () => {
        return await this.enquirer.selectPrompt(this.isInteractive, 'Please select hibernation status for the branch', [
          { name: 'true', message: 'Hibernated' },
          { name: 'false', message: 'Not hibernated' }
        ]);
      })
      .with('scale-to-zero', async () => {
        return await this.enquirer.selectPrompt(
          this.isInteractive,
          `Please select scale to zero status for the branch (current: ${defaultScaleToZero ? 'Enabled' : 'Disabled'})`,
          [...scaleToZeroChoices]
        );
      })
      .with('inactivity-period', async () => {
        return await this.enquirer.selectPrompt(
          this.isInteractive,
          `Please select inactivity period for the branch (current: ${defaultInactivityPeriod} minutes)`,
          [...timeChoices]
        );
      })
      .with('postgres-version', async () => {
        return await this.enquirer.selectPrompt(
          this.isInteractive,
          `Please select the PostgreSQL version for this branch (current: ${branch.configuration.image})`,
          upgradeableImageChoices
        );
      })
      .exhaustive();
  }

  if (!value) {
    this.process.stderr.write(chalk.red(`Expected value for field ${field}`));
    this.process.exit(1);
  }

  const storageOverLimit = field === 'storage' && maxStorage !== undefined && Number(value) > maxStorage;
  const paymentMethodOnFile = storageOverLimit ? await hasPaymentMethod(this, organizationId) : false;

  match(field)
    .with('name', () => {
      if (!value.trim()) {
        this.process.stderr.write(chalk.red('Branch name cannot be empty'));
        this.process.exit(1);
      }
    })
    .with('replicas', () => {
      const validReplicas = replicaChoices.map((choice) => choice.name);
      if (!validReplicas.includes(value)) {
        this.process.stderr.write(
          chalk.red(`Invalid replicas value: ${value}. Valid values are: ${validReplicas.join(', ')}`)
        );
        this.process.exit(1);
      }
    })
    .with('instance-type', () => {
      const instance = instances.find((t) => t.name === value);
      if (!instance) {
        const validInstanceTypes = instances.map((t) => t.name);
        this.process.stderr.write(
          chalk.red(`Invalid instance type: ${value}. Valid values are: ${validInstanceTypes.join(', ')}`)
        );
        this.process.exit(1);
      }
      if (maxAllowedVCPUs && instance.vcpus > maxAllowedVCPUs) {
        this.process.stderr.write(chalk.red(`${instanceTypeUnavailableMessage(value)}\n`));
        this.process.exit(1);
      }
    })
    .with('storage', () => {
      const storageGB = Number(value);
      if (!Number.isInteger(storageGB) || storageGB < 1) {
        this.process.stderr.write(chalk.red(`Invalid storage value: ${value}. Storage must be a whole number of GB.`));
        this.process.exit(1);
      }
      const currentStorage = branch.configuration.storage;
      if (currentStorage !== undefined && storageGB < currentStorage) {
        this.process.stderr.write(chalk.red(`Storage cannot be decreased (current: ${currentStorage} GB).\n`));
        this.process.exit(1);
      }
      if (maxStorage !== undefined && storageGB > maxStorage) {
        this.process.stderr.write(chalk.red(`${storageLimitMessage(maxStorage, paymentMethodOnFile)}\n`));
        this.process.exit(1);
      }
    })
    .with('hibernate', () => {
      const validHibernateValues = ['true', 'false'];
      if (!validHibernateValues.includes(value)) {
        this.process.stderr.write(
          chalk.red(`Invalid hibernate value: ${value}. Valid values are: ${validHibernateValues.join(', ')}`)
        );
        this.process.exit(1);
      }
    })
    .with('scale-to-zero', () => {
      if (!validScaleToZeroValues.includes(value)) {
        this.process.stderr.write(
          chalk.red(`Invalid scale to zero value: ${value}. Valid values are: ${validScaleToZeroValues.join(', ')}`)
        );
        this.process.exit(1);
      }
    })
    .with('inactivity-period', () => {
      if (!validInactivityPeriodValues.includes(value)) {
        this.process.stderr.write(
          chalk.red(
            `Invalid inactivity period value: ${value}. Valid values are: ${validInactivityPeriodValues.join(', ')}`
          )
        );
        this.process.exit(1);
      }
    })
    .with('postgres-version', () => {
      if (!upgradeableImageChoices.some((choice) => choice.name === value)) {
        this.process.stderr.write(
          chalk.red(
            `Invalid PostgreSQL version: ${value}. Not a compatible upgrade for current image ${branch.configuration.image}.\n`
          )
        );
        this.process.exit(1);
      }
    })
    .exhaustive();

  const updateBody = match(field)
    .with('name', () => {
      return {
        name: value
      };
    })
    .with('replicas', () => {
      return {
        replicas: parseInt(value)
      };
    })
    .with('instance-type', () => {
      return {
        instanceType: value
      };
    })
    .with('storage', () => {
      return {
        storage: parseInt(value)
      };
    })
    .with('hibernate', () => {
      return {
        hibernate: value === 'true'
      };
    })
    .with('scale-to-zero', () => {
      return {
        scaleToZero: {
          ...branch.scaleToZero,
          enabled: value === 'true'
        }
      };
    })
    .with('inactivity-period', () => {
      return {
        scaleToZero: {
          ...branch.scaleToZero,
          inactivityPeriodMinutes: parseInt(value)
        }
      };
    })
    .with('postgres-version', () => {
      return {
        image: value
      };
    })
    .exhaustive();

  const updatedBranch = await this.api.branches.updateBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId },
    body: updateBody
  });

  if (flags.json) {
    this.process.stdout.write(JSON.stringify(updatedBranch, null, 2));
  } else {
    this.process.stdout.write(chalk.green(`Successfully updated ${field} to ${value}\n`));
  }
}

export const BranchSetCommand = buildCommand({
  docs: {
    brief: 'Set a field value for a branch',
    fullDescription:
      'The `postgres-version` field upgrades PostgreSQL, and only accepts compatible upgrades within the same major version and offering type.',
    customUsage: [
      { input: 'replicas 2 my-branch', brief: 'Set a field non-interactively' },
      { input: 'postgres-version', brief: 'Select the target version interactively' },
      { input: 'postgres-version postgres:17.7', brief: 'Upgrade to a specific PostgreSQL version' }
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
      branch: {
        kind: 'parsed',
        brief: 'Branch ID',
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
          brief:
            'The field to set: name, replicas, instance-type, storage, hibernate, scale-to-zero, inactivity-period or postgres-version',
          parse: String,
          placeholder: 'field',
          default: '.catalog'
        },
        {
          brief: 'The value to set. Prompted for when omitted in an interactive terminal',
          parse: String,
          placeholder: 'value',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
