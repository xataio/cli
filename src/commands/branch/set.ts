import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import { match } from 'ts-pattern';
import type { LocalContext } from '~/context';
import { CLI_NAME } from '~/lib/constants';
import { instanceTypeChoices, instanceTypes, replicaChoices } from './create';
import { validScaleToZeroValues, validInactivityPeriodValues, scaleToZeroChoices, timeChoices } from '~/lib/config';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  json: boolean;
};

type Field = 'name' | 'replicas' | 'instance-type' | 'hibernate' | 'scale-to-zero' | 'inactivity-period';
type FieldArg = Field | '.catalog';

export async function implementation(this: LocalContext, flags: Flags, fieldArg: string, value?: string) {
  const field = fieldArg as FieldArg;
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId });

  const validFields: Field[] = ['name', 'replicas', 'instance-type', 'hibernate', 'scale-to-zero', 'inactivity-period'];
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

  const instances = await instanceTypes(this, organizationId, branchRegion);
  const instanceChoices = instanceTypeChoices(instances);

  if (!value) {
    value = await match(field)
      .with('name', async () => {
        return await this.enquirer.inputPrompt(this.isCI, 'Please enter the new branch name');
      })
      .with('replicas', async () => {
        return await this.enquirer.selectPrompt(
          this.isCI,
          'Please select number of replicas for the branch',
          replicaChoices
        );
      })
      .with('instance-type', async () => {
        return await this.enquirer.selectPrompt(
          this.isCI,
          'Please select the type of instance for this branch',
          instanceChoices
        );
      })
      .with('hibernate', async () => {
        return await this.enquirer.selectPrompt(this.isCI, 'Please select hibernation status for the branch', [
          { name: 'true', message: 'Hibernated' },
          { name: 'false', message: 'Not hibernated' }
        ]);
      })
      .with('scale-to-zero', async () => {
        return await this.enquirer.selectPrompt(
          this.isCI,
          `Please select scale to zero status for the branch (current: ${defaultScaleToZero ? 'Enabled' : 'Disabled'})`,
          [...scaleToZeroChoices]
        );
      })
      .with('inactivity-period', async () => {
        return await this.enquirer.selectPrompt(
          this.isCI,
          `Please select inactivity period for the branch (current: ${defaultInactivityPeriod} minutes)`,
          [...timeChoices]
        );
      })
      .exhaustive();
  }

  if (!value) {
    this.process.stderr.write(chalk.red(`Expected value for field ${field}`));
    this.process.exit(1);
  }

  match(field)
    .with('name', () => {
      if (!value.trim()) {
        this.process.stderr.write(chalk.red('Branch name cannot be empty'));
        this.process.exit(1);
      }
    })
    .with('replicas', () => {
      const validReplicas = ['0', '1', '2', '3', '4'];
      if (!validReplicas.includes(value)) {
        this.process.stderr.write(
          chalk.red(`Invalid replicas value: ${value}. Valid values are: ${validReplicas.join(', ')}`)
        );
        this.process.exit(1);
      }
    })
    .with('instance-type', () => {
      const validInstanceTypes = instances.map((t) => t.name);
      if (!validInstanceTypes.includes(value)) {
        this.process.stderr.write(
          chalk.red(`Invalid instance type: ${value}. Valid values are: ${validInstanceTypes.join(', ')}`)
        );
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
    brief: 'Set a field value for a branch'
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
          brief: 'The field to set',
          parse: String,
          placeholder: 'field',
          default: '.catalog'
        },
        {
          brief: 'The value to set',
          parse: String,
          placeholder: 'value',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
