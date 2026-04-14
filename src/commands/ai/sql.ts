import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import invariant from 'tiny-invariant';

import { BUILD_SCHEMA_QUERY, buildConnectionString, type Schema } from '@xata.io/sql';
import { parse } from 'pg-connection-string';
import type { LocalContext } from '~/context';
import { CLI_NAME } from '~/lib/constants';
import { env } from '~/lib/env';
import postgres from 'postgres';
import { formatSchemaForAI, generateSQL } from '@xata.io/ai';
import { TerminalUI } from './terminal-ui.js';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  database?: string;
  yes: boolean;
};

async function getBranchSchema(
  api: LocalContext['api'],
  organizationId: string,
  projectId: string,
  branchId: string,
  database: string
): Promise<Schema[]> {
  const { connectionString } = await api.branches.describeBranch({
    pathParams: {
      organizationID: organizationId,
      projectID: projectId,
      branchID: branchId
    }
  });

  if (!connectionString) {
    throw new Error('Connection string not found');
  }

  const { host, port, user, password, application_name } = parse(connectionString);

  if (!host || !user) {
    throw new Error('Invalid connection string');
  }

  const postgres = (await import('postgres')).default;
  const sql = postgres({
    host,
    database,
    port: parseInt(port ?? '5432'),
    user,
    password,
    connection: {
      application_name
    },
    ssl: { rejectUnauthorized: false }
  });

  try {
    const schemaResult = await sql.unsafe<Schema[]>(BUILD_SCHEMA_QUERY);
    return schemaResult;
  } finally {
    await sql.end();
  }
}

async function executeSQL(sql: string, connectionString: string): Promise<any[]> {
  const db = postgres(connectionString);

  try {
    const result = await db.unsafe(sql);
    return Array.isArray(result) ? result : [result];
  } finally {
    await db.end();
  }
}

export async function implementation(this: LocalContext, flags: Flags) {
  try {
    const organizationId = await this.getOrganization(this, flags, {});
    const projectId = await this.getProject(this, flags, { organizationId });
    const branchId = await this.getBranch(this, flags, { organizationId, projectId });

    const databaseName = await this.getDatabase(this, flags);
    if (!databaseName) {
      this.process.stderr.write(chalk.red('Expected input for flag --database\n'));
      this.process.exit(1);
    }

    const branch = await this.api.branches.describeBranch({
      pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
    });

    if (branch.status.statusType !== 'STATUS_TYPE_HEALTHY') {
      this.process.stderr.write(
        chalk.red(
          `The branch is not healthy (statusType=${branch.status.statusType}). Please use ${chalk.bold(`${CLI_NAME} branch wait-ready --wake`)} command to wait for this branch to be healthy.\n`
        )
      );
      return;
    }

    invariant(branch.connectionString, 'Branch should have a connection string at this point.');
    const connectionString = buildConnectionString(branch.connectionString);

    const schema = await getBranchSchema(this.api, organizationId, projectId, branchId, databaseName);
    const formattedSchema = formatSchemaForAI(schema);

    const handleExecuteSQL = async (sql: string): Promise<any[]> => {
      return await executeSQL(sql, connectionString);
    };

    const handleGenerateSQL = async (query: string, currentSQL: string): Promise<string> => {
      invariant(env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY is required for AI features');
      return await generateSQL(env.ANTHROPIC_API_KEY, query, formattedSchema, currentSQL);
    };

    const ui = new TerminalUI({
      schema,
      formattedSchema,
      onExecuteSQL: handleExecuteSQL,
      onGenerateSQL: handleGenerateSQL
    });

    return ui.start();
  } catch (error) {
    console.error(chalk.red(`❌ Error: `));
    console.log(error);
    this.process.exit(1);
  }
}

export const GenerateSQLCommand = buildCommand({
  docs: {
    brief: 'Interactive AI-powered SQL query generator'
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
      yes: {
        kind: 'boolean',
        brief: 'Do not ask for confirmation, assume yes.',
        default: false
      }
    }
  },
  func: implementation
});
