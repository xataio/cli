import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { createRootBranch, getInstanceType, getImage, getRegion, getReplicas } from '../branch/create';

type Flags = {
  organization?: string;
  name: string;
  'branch-name'?: string;
  replicas?: '0' | '1' | '2' | '3' | '4';
  'instance-type'?: string;
  region?: string;
  'scale-to-zero-base'?: 'true' | 'false';
  'scale-to-zero-child'?: 'true' | 'false';
  'inactivity-period-base'?: '15' | '30' | '60' | '120' | '180';
  'inactivity-period-child'?: '15' | '30' | '60' | '120' | '180';
  json: boolean;
  'postgres-version'?: string;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});

  const branchName = await this.enquirer.inputPrompt(this.isCI, 'Please enter the branch name', {
    flag: flags['branch-name'],
    placeholder: 'main'
  });
  if (!branchName) {
    this.process.stderr.write(chalk.red(`Branch name is required`));
    this.process.exit(1);
  }

  const region = await getRegion(this, flags, { organizationId });
  const replicas = await getReplicas(this, flags, { organizationId });
  const instanceType = await getInstanceType(this, flags, { organizationId, region });

  const scaleToZeroBase = flags['scale-to-zero-base'] ? flags['scale-to-zero-base'] === 'true' : false;
  const scaleToZeroChild = flags['scale-to-zero-child'] ? flags['scale-to-zero-child'] === 'true' : true;
  const inactivityPeriodBase = flags['inactivity-period-base'] ? parseInt(flags['inactivity-period-base']) : 30;
  const inactivityPeriodChild = flags['inactivity-period-child'] ? parseInt(flags['inactivity-period-child']) : 30;
  const image = await getImage(this, flags, { organizationId, region });

  const project = await this.api.projects.createProject({
    pathParams: { organizationID: organizationId },
    body: {
      name: flags.name,
      configuration: {
        scaleToZero: {
          baseBranches: {
            enabled: scaleToZeroBase,
            inactivityPeriodMinutes: inactivityPeriodBase
          },
          childBranches: {
            enabled: scaleToZeroChild,
            inactivityPeriodMinutes: inactivityPeriodChild
          }
        }
      }
    }
  });

  await ensureBranch(
    this,
    organizationId,
    project.id,
    branchName,
    parseInt(replicas),
    region,
    instanceType,
    project.configuration.scaleToZero.baseBranches.enabled,
    project.configuration.scaleToZero.baseBranches.inactivityPeriodMinutes,
    image
  );
  this.print(this, flags.json, project, ['Project ID', 'Project Name'], [[project.id, project.name]]);
}

export async function ensureBranch(
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
  const { branches } = await context.api.branches.listBranches({
    pathParams: {
      organizationID: organizationId,
      projectID: projectId
    }
  });

  if (branches.length === 0) {
    await createRootBranch(
      context,
      organizationId,
      projectId,
      branchName,
      replicas,
      region,
      instanceType,
      scaleToZero,
      inactivityPeriodMinutes,
      image
    );
  } else {
    context.process.stderr.write(
      chalk.red(`A branch already exists in this project. That should not be possible as this is a new project.`)
    );
  }
}

export const ProjectCreateCommand = buildCommand({
  docs: {
    brief: 'Create a new project'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
      },
      name: {
        kind: 'parsed',
        brief: 'Project Name',
        parse: String,
        optional: false
      },
      'branch-name': {
        kind: 'parsed',
        brief: 'Branch Name',
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
      'scale-to-zero-base': {
        kind: 'enum',
        values: ['true', 'false'],
        brief: 'Default scale to zero status for base branches',
        optional: true
      },
      'scale-to-zero-child': {
        kind: 'enum',
        values: ['true', 'false'],
        brief: 'Default scale to zero status for child branches',
        optional: true
      },
      'inactivity-period-base': {
        kind: 'enum',
        values: ['15', '30', '60', '120', '180'],
        brief: 'Default inactivity period in minutes for base branches',
        optional: true
      },
      'inactivity-period-child': {
        kind: 'enum',
        values: ['15', '30', '60', '120', '180'],
        brief: 'Default inactivity period in minutes for child branches',
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
