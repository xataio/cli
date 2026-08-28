import { buildCommand } from '@stricli/core';
import { buildConnectionString, fetchBranchConnectionString } from '@xata.io/sql';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { type ContextFlags, contextFlags, getErrorMessage, resolveContext } from '~/lib/cli-utils';
import { updateBranchConfig } from '~/lib/branch-config';
import { CLI_NAME } from '~/lib/constants';
import { getLocalConfigDir } from '~/lib/config-dir';
import { getProjectConfigPath, hasProjectConfigFile, updateProjectConfig } from '~/lib/project-config';

async function checkDatabaseExists(
  context: LocalContext,
  connectionString: string,
  databaseName: string
): Promise<boolean> {
  const connectionStringWithDatabaseName = buildConnectionString(connectionString, { database: databaseName });
  const sql = context.postgres(connectionStringWithDatabaseName);
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    if (context.debug) {
      console.log(`DEBUG: Database "${databaseName}" does not exist or is not accessible: ${getErrorMessage(error)}`);
    }
    return false;
  } finally {
    await sql.end();
  }
}

async function createDatabase(context: LocalContext, connectionString: string, databaseName: string): Promise<void> {
  const defaultConnectionString = buildConnectionString(connectionString, { database: 'postgres' });

  const sql = context.postgres(defaultConnectionString);
  try {
    await sql`CREATE DATABASE ${sql(databaseName)}`;
  } catch (error) {
    throw new Error(`Failed to create database "${databaseName}": ${getErrorMessage(error)}`);
  } finally {
    await sql.end();
  }
}

export async function ensureDatabase(context: LocalContext, connectionString: string, databaseName: string) {
  const connectionStringWithDatabaseName = buildConnectionString(connectionString, { database: databaseName });
  const databaseExists = await checkDatabaseExists(context, connectionStringWithDatabaseName, databaseName);

  if (!databaseExists) {
    const shouldCreate = await context.enquirer.confirmPrompt(
      context.isInteractive,
      `Database "${databaseName}" does not exist. Would you like to create it?`
    );

    if (!shouldCreate) {
      context.process.stderr.write(chalk.red(`Database "${databaseName}" does not exist and could not be created.\n`));
      context.process.exit(1);
    }

    await createDatabase(context, connectionString, databaseName);
    context.process.stdout.write(chalk.green(`Database "${databaseName}" created successfully.\n`));
  }
}

type Flags = ContextFlags & {
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags) {
  if (hasProjectConfigFile()) {
    this.process.stdout.write(chalk.green(`Project is already initialized in ${getProjectConfigPath()}.\n`));
    this.process.stdout.write(
      chalk.bold(`To re-initialize, please delete the local project file at ${getProjectConfigPath()}`)
    );
    this.process.exit(0);
  }

  const { organizationId, projectId, branchId, database } = await resolveContext(this, flags);
  const databaseName =
    (await this.enquirer.inputPrompt(this.isInteractive, 'Please enter the database name', {
      flag: flags.database,
      placeholder: database
    })) || database;

  const branch = await this.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
  });

  if (branch.status.statusType !== 'STATUS_TYPE_HEALTHY') {
    this.process.stderr.write(
      `The branch is not healthy (statusType=${branch.status.statusType}). Please use ${chalk.bold(`${CLI_NAME} branch wait-ready`)} command to wait for this branch to be healthy.\n`
    );
    return;
  }
  const connectionString = await fetchBranchConnectionString(this.api, {
    organizationID: organizationId,
    projectID: projectId,
    branchID: branchId
  });
  await ensureDatabase(this, connectionString, databaseName);

  await updateProjectConfig({
    organizationId,
    projectId
  });

  await updateBranchConfig({
    branchId,
    branchName: branch.name,
    databaseName
  });

  if (!flags.json) {
    this.process.stdout.write(
      chalk.green(`Wrote project.json and branch.json to ${getLocalConfigDir()}. The following details were written\n`)
    );
  }

  this.print(
    this,
    flags.json,
    {
      organization: organizationId,
      project: projectId,
      branch: branchId,
      branchName: branch.name,
      databaseName
    },
    ['branch_id', 'branch', 'database', 'organization_id', 'project_id'],
    [[branchId, branch.name, databaseName, organizationId, projectId]]
  );
}

export const ProjectInitCommand = buildCommand({
  docs: {
    brief: 'Link this folder to a project and branch',
    fullDescription:
      'Writes the organization, project, branch and database to `.xata/` in this folder, so the commands run here no longer need them passed in.',
    customUsage: [
      { input: '--organization <org-id> --project <project-id> --branch <branch-id>', brief: 'Link without prompts' }
    ]
  },
  parameters: {
    flags: {
      ...contextFlags,
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      }
    }
  },
  func: implementation
});
