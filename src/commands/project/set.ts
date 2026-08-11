import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import { match } from 'ts-pattern';
import { CLI_NAME } from '~/lib/constants';
import { scaleToZeroChoices, timeChoices, validScaleToZeroValues, validInactivityPeriodValues } from '~/lib/config';
import type { LocalContext } from '~/context';

type Flags = {
  organization?: string;
  project?: string;
  json: boolean;
};

type Field =
  | 'name'
  | 'scale-to-zero-base'
  | 'scale-to-zero-child'
  | 'inactivity-period-base'
  | 'inactivity-period-child';
type FieldArg = Field | '.catalog';

export async function implementation(this: LocalContext, flags: Flags, fieldArg: string, value?: string) {
  const field = fieldArg as FieldArg;

  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });

  const validFields: Field[] = [
    'name',
    'scale-to-zero-base',
    'scale-to-zero-child',
    'inactivity-period-base',
    'inactivity-period-child'
  ];
  const excludedFields: Field[] = [];

  if (field === '.catalog') {
    this.process.stdout.write(`Usage ${chalk.bold.italic(`${CLI_NAME} project set <field> <value>`)}\n\n`);
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

  const project = await this.api.projects.getProject({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });

  const projectName = project.name;

  const scaleToZeroBase = project.configuration.scaleToZero.baseBranches.enabled;
  const inactivityPeriodBase = project.configuration.scaleToZero.baseBranches.inactivityPeriodMinutes;
  const scaleToZeroChild = project.configuration.scaleToZero.childBranches.enabled;
  const inactivityPeriodChild = project.configuration.scaleToZero.childBranches.inactivityPeriodMinutes;

  if (!value) {
    value = await match(field)
      .with('name', async () => {
        return await this.enquirer.inputPrompt(
          this.isInteractive,
          `Please enter the new project name (current: ${projectName})`
        );
      })
      .with('scale-to-zero-base', async () => {
        return await this.enquirer.selectPrompt(
          this.isInteractive,
          `Please select the default scale to zero status for the base branch (current: ${scaleToZeroBase ? 'Enabled' : 'Disabled'})`,
          [...scaleToZeroChoices]
        );
      })
      .with('scale-to-zero-child', async () => {
        return await this.enquirer.selectPrompt(
          this.isInteractive,
          `Please select the default scale to zero status for the child branches (current: ${scaleToZeroChild ? 'Enabled' : 'Disabled'})`,
          [...scaleToZeroChoices]
        );
      })
      .with('inactivity-period-base', async () => {
        return await this.enquirer.selectPrompt(
          this.isInteractive,
          `Please select the default inactivity period for the base branch (current: ${inactivityPeriodBase} minutes)`,
          [...timeChoices]
        );
      })
      .with('inactivity-period-child', async () => {
        return await this.enquirer.selectPrompt(
          this.isInteractive,
          `Please select the default inactivity period for the child branches (current: ${inactivityPeriodChild} minutes)`,
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
        this.process.stderr.write(chalk.red('Project name cannot be empty'));
        this.process.exit(1);
      }
    })
    .with('scale-to-zero-base', () => {
      if (!validScaleToZeroValues.includes(value)) {
        this.process.stderr.write(
          chalk.red(
            `Invalid scale to zero base value: ${value}. Valid values are: ${validScaleToZeroValues.join(', ')}`
          )
        );
        this.process.exit(1);
      }
    })
    .with('scale-to-zero-child', () => {
      if (!validScaleToZeroValues.includes(value)) {
        this.process.stderr.write(
          chalk.red(
            `Invalid scale to zero child value: ${value}. Valid values are: ${validScaleToZeroValues.join(', ')}`
          )
        );
        this.process.exit(1);
      }
    })
    .with('inactivity-period-base', () => {
      if (!validInactivityPeriodValues.includes(value)) {
        this.process.stderr.write(
          chalk.red(
            `Invalid inactivity period base value: ${value}. Valid values are: ${validInactivityPeriodValues.join(', ')}`
          )
        );
        this.process.exit(1);
      }
    })
    .with('inactivity-period-child', () => {
      if (!validInactivityPeriodValues.includes(value)) {
        this.process.stderr.write(
          chalk.red(
            `Invalid inactivity period child value: ${value}. Valid values are: ${validInactivityPeriodValues.join(', ')}`
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
    .with('scale-to-zero-base', () => {
      return {
        scaleToZeroBase: value === 'true'
      };
    })
    .with('scale-to-zero-child', () => {
      return {
        scaleToZeroChild: value === 'true'
      };
    })
    .with('inactivity-period-base', () => {
      return {
        inactivityPeriodBase: value
      };
    })
    .with('inactivity-period-child', () => {
      return {
        inactivityPeriodChild: value
      };
    })
    .exhaustive();

  // Only send the changed field and use original values for others
  const scaleToZeroConfig = {
    baseBranches: {
      enabled: (updateBody as any).scaleToZeroBase ?? scaleToZeroBase,
      inactivityPeriodMinutes: (updateBody as any).inactivityPeriodBase
        ? parseInt((updateBody as any).inactivityPeriodBase)
        : inactivityPeriodBase
    },
    childBranches: {
      enabled: (updateBody as any).scaleToZeroChild ?? scaleToZeroChild,
      inactivityPeriodMinutes: (updateBody as any).inactivityPeriodChild
        ? parseInt((updateBody as any).inactivityPeriodChild)
        : inactivityPeriodChild
    }
  };

  const updatedProject = await this.api.projects.updateProject({
    pathParams: { organizationID: organizationId, projectID: projectId },
    body: {
      ...updateBody,
      configuration: {
        scaleToZero: scaleToZeroConfig
      }
    }
  });

  if (flags.json) {
    this.process.stdout.write(JSON.stringify(updatedProject, null, 2));
  } else {
    this.process.stdout.write(chalk.green(`Successfully updated ${field} for project ${projectName}\n`));
  }
}

export const ProjectSetCommand = buildCommand({
  docs: {
    brief: 'Set a field value for a project',
    fullDescription:
      'The fields are name, scale-to-zero-base, scale-to-zero-child, inactivity-period-base and inactivity-period-child. The scale to zero and inactivity fields are the defaults new branches inherit, base for branches without a parent and child for the rest. Run it without a field to list them.',
    customUsage: [{ input: 'scale-to-zero-child true', brief: 'Let new child branches scale to zero' }]
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
