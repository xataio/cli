import { buildCommand } from '@stricli/core';
import chalk from 'chalk';

import {
  BUILD_SCHEMA_QUERY,
  buildCredentialsConnectionString,
  fetchBranchCredentials,
  type Schema
} from '@xata.io/sql';
import type { LocalContext } from '~/context';
import { exitWithError, getErrorMessage } from '~/lib/cli-utils';
import { CLI_NAME } from '~/lib/constants';
import type postgres from 'postgres';
import { formatSchemaForAI, generateSQL } from '@xata.io/ai';
import { render } from 'ink';
import { createElement } from 'react';
import { AIApp } from '~/ai/app';
import type { SQLResult } from '~/ai/sql-view';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  database?: string;
  model?: string;
  yes: boolean;
};

async function getBranchSchema(context: LocalContext, connectionString: string): Promise<Schema[]> {
  const sql = context.postgres(connectionString);

  try {
    const schemaResult = await sql.unsafe<Schema[]>(BUILD_SCHEMA_QUERY);
    return schemaResult;
  } finally {
    await sql.end({ timeout: 2 });
  }
}

type QueryRows = Record<string, unknown>[] & {
  command: string | null;
  count: number | null;
  columns?: { name: string }[] | null;
};

export const normalizeResults = (result: QueryRows | QueryRows[]): SQLResult[] => {
  const sets = 'command' in result ? [result] : result;
  return sets.map((rows) => ({
    command: rows.command ?? 'SQL',
    count: rows.count,
    columns: rows.columns?.map((column) => column.name) ?? [],
    rows: Array.from(rows)
  }));
};

export async function implementation(this: LocalContext, flags: Flags) {
  if (!this.isInteractive || !this.process.stdin.isTTY || !this.process.stdout.isTTY) {
    return exitWithError(this, '`xata ai sql` requires an interactive terminal.');
  }
  const apiKey = this.env.ANTHROPIC_API_KEY;
  if (!apiKey) return exitWithError(this, 'Set ANTHROPIC_API_KEY in the environment to generate SQL.');
  let activeDatabase: postgres.Sql | undefined;
  const controller = new AbortController();
  try {
    const organizationId = await this.getOrganization(this, flags, {});
    const projectId = await this.getProject(this, flags, { organizationId });
    const branchId = await this.getBranch(this, flags, { organizationId, projectId });

    const databaseName = await this.getDatabase(flags);
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

    const credentials = await fetchBranchCredentials(this.api, {
      organizationID: organizationId,
      projectID: projectId,
      branchID: branchId
    });
    const connectionString = buildCredentialsConnectionString(credentials, {
      database: databaseName
    });

    const schema = await getBranchSchema(this, connectionString);
    const formattedSchema = formatSchemaForAI(schema);

    const handleExecuteSQL = async (sql: string): Promise<SQLResult[]> => {
      const db = this.postgres(connectionString);
      activeDatabase = db;
      try {
        return normalizeResults(await db.unsafe<Record<string, unknown>[]>(sql));
      } finally {
        await db.end({ timeout: 2 });
        if (activeDatabase === db) activeDatabase = undefined;
      }
    };

    const handleGenerateSQL = async (query: string, currentSQL: string): Promise<string> => {
      return await generateSQL(apiKey, query, formattedSchema, currentSQL, {
        model: flags.model,
        abortSignal: controller.signal
      });
    };

    const ui = render(
      createElement(AIApp, {
        target: `${organizationId} / ${projectId} / ${branch.name} · ${databaseName}`,
        schemaCount: schema.length,
        tableCount: schema.reduce((total, item) => total + Object.keys(item.tables).length, 0),
        onExecuteSQL: handleExecuteSQL,
        onGenerateSQL: handleGenerateSQL
      }),
      {
        stdin: this.process.stdin,
        stdout: this.process.stdout,
        stderr: this.process.stderr
      }
    );

    try {
      await ui.waitUntilExit();
    } finally {
      ui.unmount();
    }
  } catch (error) {
    this.process.stderr.write(chalk.red(`${getErrorMessage(error)}\n`));
    this.process.exitCode = 1;
  } finally {
    controller.abort();
    await activeDatabase?.end({ timeout: 2 });
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
        brief: 'Branch ID or name',
        parse: String,
        optional: true
      },
      database: {
        kind: 'parsed',
        brief: 'Database name',
        parse: String,
        optional: true
      },
      model: {
        kind: 'parsed',
        brief: 'Anthropic model override for AI SQL generation',
        parse: String,
        optional: true
      },
      yes: {
        kind: 'boolean',
        brief: 'Skip setup confirmations. SQL execution always requires approval.',
        default: false
      }
    }
  },
  func: implementation
});
