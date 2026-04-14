import { buildCommand } from '@stricli/core';
import { buildConnectionString } from '@xata.io/sql';
import chalk from 'chalk';
import dedent from 'dedent';
import invariant from 'tiny-invariant';
import type { LocalContext } from '~/context';
import { getErrorMessage } from '~/lib/cli-utils';
import { updateBranchConfig } from '~/lib/branch-config';
import { isCLIConfigInitialized } from '~/lib/cli-config';
import { CLI_NAME } from '~/lib/constants';
import { getProjectConfigDir, getProjectConfigPath, updateProjectConfig } from '~/lib/project-config';

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
      context.isCI,
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

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  database?: string;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags) {
  if (isCLIConfigInitialized(this)) {
    this.process.stdout.write(chalk.green(`Project is already initialized in ${getProjectConfigPath()}.\n`));
    this.process.stdout.write(
      chalk.bold(`To re-initialize, please delete the local project file at ${getProjectConfigPath()}`)
    );
    this.process.exit(0);
  }

  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId });

  const databaseName = await this.getDatabase(this, flags);
  if (!databaseName) {
    this.process.stderr.write(chalk.red(`Expected input for flag --database`));
    this.process.exit(1);
  }

  const branch = await this.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
  });

  if (branch.status.statusType !== 'STATUS_TYPE_HEALTHY') {
    this.process.stderr.write(
      `The branch is not healthy (statusType=${branch.status.statusType}). Please use ${chalk.bold(`${CLI_NAME} branch wait-ready`)} command to wait for this branch to be healthy.\n`
    );
    return;
  }
  invariant(branch.connectionString, 'Branch should have a connection string at this point.');
  await ensureDatabase(this, branch.connectionString, databaseName);

  await updateProjectConfig({
    organizationId,
    projectId
  });

  await updateBranchConfig({
    branchId,
    branchName: branch.name,
    databaseName
  });

  const dotGitIgnore = dedent`
    project.json
    branch.json
  `;
  this.fs.writeFileSync(this.path.join(getProjectConfigDir(), '.gitignore'), dotGitIgnore);

  if (!flags.json) {
    this.process.stdout.write(
      chalk.green(
        `Wrote project.json and branch.json to ${getProjectConfigDir()}. The following details were written\n`
      )
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
    ['Branch ID', 'Branch Name', 'Database Name', 'Organization ID', 'Project ID'],
    [[branchId, branch.name, databaseName, organizationId, projectId]]
  );
}

export const ProjectInitCommand = buildCommand({
  docs: {
    brief: 'Link a project to the folder'
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
