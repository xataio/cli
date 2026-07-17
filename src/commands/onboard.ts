import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { implementation as orgCreateImplementation } from './organization/create';
import { implementation as projectCreateImplementation } from './project/create';
import { implementation as initImplementation } from './project/init';
import { getUserInfo } from '~/lib/cli-utils';
import { getDefaultOrganizationName } from '@xata.io/utils';
import invariant from 'tiny-invariant';

type Flags = {
  'organization-name'?: string;
  'project-name'?: string;
  'branch-name'?: string;

  replicas?: string;
  'instance-type'?: string;
  region?: string;
  'scale-to-zero-base'?: 'true' | 'false';
  'scale-to-zero-child'?: 'true' | 'false';
  'inactivity-period-base'?: '15' | '30' | '60' | '120' | '180';
  'inactivity-period-child'?: '15' | '30' | '60' | '120' | '180';
  database?: string;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags) {
  this.process.stdout.write(chalk.bold('🚀 Welcome to Xata! Setting up your complete environment...\n\n'));

  // Check if any organizations already exist - onboard is meant to be used only once
  const existingOrganizations = await this.api.organizations.getOrganizationsList();
  if (existingOrganizations.organizations.length > 0) {
    this.process.stderr.write(chalk.red('❌ Organizations already exist in your account.\n\n'));
    this.process.stderr.write(chalk.yellow('The onboard command is intended for first-time setup only.\n'));
    this.process.stderr.write(chalk.yellow('Use these commands instead:\n'));
    this.process.stderr.write(
      chalk.gray('• Create new organization: ') + chalk.cyan('xata org create --name <org-name>\n')
    );
    this.process.stderr.write(
      chalk.gray('• Create new project: ') + chalk.cyan('xata project create --name <project-name>\n')
    );
    this.process.stderr.write(
      chalk.gray('• Create new branch: ') + chalk.cyan('xata branch create --name <branch-name>\n')
    );
    this.process.stderr.write(chalk.gray('• Initialize project: ') + chalk.cyan('xata init\n'));
    this.process.exit(1);
  }

  // Get user info for smart default organization name
  const userInfo = getUserInfo();

  // Prompt for missing required parameters with smart defaults
  const organizationName =
    flags['organization-name'] ||
    (await this.enquirer.inputPrompt(this.isInteractive, 'Please enter the organization name', {
      placeholder: getDefaultOrganizationName(userInfo)
    })) ||
    getDefaultOrganizationName(userInfo);
  if (!organizationName) {
    this.process.stderr.write(chalk.red('Organization name is required'));
    this.process.exit(1);
  }

  const projectName =
    flags['project-name'] ||
    (await this.enquirer.inputPrompt(this.isInteractive, 'Please enter the project name', {
      placeholder: 'First Project'
    })) ||
    'First Project';
  if (!projectName) {
    this.process.stderr.write(chalk.red('Project name is required'));
    this.process.exit(1);
  }

  const branchName =
    flags['branch-name'] ||
    (await this.enquirer.inputPrompt(this.isInteractive, 'Please enter the branch name', {
      placeholder: 'main'
    })) ||
    'main';

  // Step 1: Create organization
  this.process.stdout.write(chalk.blue('Step 1/4: Creating organization...\n'));
  await orgCreateImplementation.call(this, {
    name: organizationName,
    json: false
  });
  this.process.stdout.write(chalk.green('✓ Organization created successfully!\n\n'));

  // Get the organization ID from the created org
  const organizations = await this.api.organizations.getOrganizationsList();
  const createdOrg = organizations.organizations.find((org) => org.name === organizationName);
  if (!createdOrg) {
    this.process.stderr.write(chalk.red('Failed to find the created organization'));
    this.process.exit(1);
  }

  // Step 2: Create project with branch
  this.process.stdout.write(chalk.blue('Step 2/4: Creating project and main branch...\n'));
  await projectCreateImplementation.call(this, {
    organization: createdOrg.id,
    name: projectName,
    'branch-name': branchName,
    replicas: flags.replicas,
    'instance-type': flags['instance-type'],
    region: flags.region,
    'scale-to-zero-base': flags['scale-to-zero-base'],
    'scale-to-zero-child': flags['scale-to-zero-child'],
    'inactivity-period-base': flags['inactivity-period-base'],
    'inactivity-period-child': flags['inactivity-period-child'],
    json: false
  });
  this.process.stdout.write(chalk.green('✓ Project and branch created successfully!\n\n'));

  // Step 3: Prompt for project initialization
  this.process.stdout.write(chalk.blue('Step 3/4: Project initialization (optional)\n'));
  this.process.stdout.write(
    chalk.gray('Initialization will link this folder to your Xata project, allowing you to:\n')
  );
  this.process.stdout.write(chalk.gray('• Use commands without specifying project/branch IDs\n'));
  this.process.stdout.write(chalk.gray('• Generate configuration files for local development\n'));
  this.process.stdout.write(chalk.gray('• Set up database connection in this directory\n\n'));

  const shouldInitialize = await this.enquirer.confirmPrompt(
    this.isInteractive,
    'Would you like to initialize this project in the current folder?'
  );

  if (shouldInitialize) {
    this.process.stdout.write(chalk.blue('Step 4/4: Initializing project...\n'));

    const projects = await this.api.projects.listProjects({
      pathParams: { organizationID: createdOrg.id }
    });
    const createdProject = projects.projects.find((proj) => proj.name === projectName);
    if (!createdProject) {
      this.process.stderr.write(chalk.red('Failed to find the created project'));
      this.process.exit(1);
    }

    const branches = await this.api.branches.listBranches({
      pathParams: {
        organizationID: createdOrg.id,
        projectID: createdProject.id
      }
    });
    const mainBranch = branches.branches[0];
    invariant(mainBranch, 'main branch should exist at this stage');

    // Wait for branch to be healthy before initialization
    this.process.stdout.write(chalk.gray('Waiting for branch to be ready...\n'));
    let branchReady = false;
    while (!branchReady) {
      const branch = await this.api.branches.describeBranch({
        pathParams: {
          organizationID: createdOrg.id,
          projectID: createdProject.id,
          branchID: mainBranch.id
        }
      });

      if (branch.status.statusType === 'STATUS_TYPE_HEALTHY') {
        branchReady = true;
        this.process.stdout.write(chalk.green('✓ Branch is ready!\n'));
      } else {
        this.process.stdout.write(chalk.gray('.'));
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before checking again
      }
    }

    await initImplementation.call(this, {
      organization: createdOrg.id,
      project: createdProject.id,
      branch: mainBranch.id,
      database: flags.database,
      json: false
    });
    this.process.stdout.write(chalk.green('✓ Project initialized successfully!\n\n'));
  } else {
    this.process.stdout.write(chalk.yellow('⚠ Skipped project initialization.\n\n'));
  }

  // Summary
  if (!flags.json) {
    this.process.stdout.write(chalk.bold.green('🎉 Onboarding complete!\n\n'));
    this.process.stdout.write(chalk.bold('What was created:\n'));
    this.process.stdout.write(`• Organization: ${chalk.cyan(organizationName)}\n`);
    this.process.stdout.write(`• Project: ${chalk.cyan(projectName)}\n`);
    this.process.stdout.write(`• Branch: ${chalk.cyan(branchName)}\n`);
    if (shouldInitialize) {
      this.process.stdout.write(`• Local configuration files\n`);
    }
    this.process.stdout.write('\n');
    this.process.stdout.write(chalk.bold('Next steps:\n'));
    this.process.stdout.write('• Check your project status: xata status\n');
    this.process.stdout.write('• Wait for branch to be ready: xata branch wait-ready\n');
    this.process.stdout.write('• Start building with Xata! 🚀\n');
  }
}

export const OnboardCommand = buildCommand({
  docs: {
    brief: 'Complete onboarding: create organization, project, branch, and optionally initialize'
  },
  parameters: {
    flags: {
      'organization-name': {
        kind: 'parsed',
        brief: 'Organization Name',
        parse: String,
        optional: true
      },
      'project-name': {
        kind: 'parsed',
        brief: 'Project Name',
        parse: String,
        optional: true
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
        kind: 'parsed',
        parse: String,
        brief: 'Please select number of replicas for the branch',
        optional: true
      },
      region: {
        kind: 'parsed',
        brief: 'Please select a region for the branch',
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
      database: {
        kind: 'parsed',
        brief: 'Database name',
        parse: String,
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
