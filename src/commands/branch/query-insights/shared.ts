import type { Types } from '@xata.io/api';
import {
  checkPgStatStatementsUsable,
  compileSql,
  fetchBranchConnectionString,
  getPgStatStatementsStatus,
  PG_STAT_STATEMENTS_EXTENSION,
  type RawBuilder
} from '@xata.io/sql';
import chalk from 'chalk';
import type postgres from 'postgres';
import type { LocalContext } from '~/context';
import { CLI_NAME } from '~/lib/constants';
import { getErrorMessage } from '~/lib/cli-utils';

export const ADMIN_DATABASE = 'postgres';

export type BranchQueryInsightsFlags = {
  organization?: string;
  project?: string;
  branch?: string;
};

type BranchSqlMeta = {
  organizationId: string;
  projectId: string;
  branchId: string;
  branch: Types.BranchMetadata;
};

type BranchQueryInsightsTarget = BranchSqlMeta;

type WithBranchQueryInsightsSqlOptions = {
  requirePgStatStatements?: boolean;
};

export async function withBranchQueryInsightsSql<T>(
  context: LocalContext,
  flags: BranchQueryInsightsFlags,
  branchName: string | undefined,
  run: (sql: postgres.Sql, meta: BranchSqlMeta) => Promise<T>,
  options: WithBranchQueryInsightsSqlOptions = {}
): Promise<T | undefined> {
  const target = await resolveBranchQueryInsightsTarget(context, flags, branchName);
  if (!target) return undefined;

  const { organizationId, projectId, branchId, branch } = target;

  try {
    return await withBranchAdminSql(context, target, async (sql) => {
      if (options.requirePgStatStatements !== false) {
        const isUsable = await ensurePgStatStatementsUsable(context, sql, branch.name);
        if (!isUsable) return undefined;
      }

      return await run(sql, { organizationId, projectId, branchId, branch });
    });
  } catch (error) {
    context.process.stderr.write(chalk.red(`${formatQueryInsightsError(error)}\n`));
    context.process.exitCode = 1;
    return undefined;
  }
}

export async function withBranchAdminSql<T>(
  context: LocalContext,
  { organizationId, projectId, branchId }: Omit<BranchSqlMeta, 'branch'>,
  run: (sql: postgres.Sql) => Promise<T>
): Promise<T> {
  const connectionString = await fetchBranchConnectionString(
    context.api,
    { organizationID: organizationId, projectID: projectId, branchID: branchId },
    { database: ADMIN_DATABASE, endpointType: 'rw' }
  );

  const sql = context.postgres(connectionString);
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}

export async function resolveBranchQueryInsightsTarget(
  context: LocalContext,
  flags: BranchQueryInsightsFlags,
  branchName: string | undefined
): Promise<BranchQueryInsightsTarget | undefined> {
  const organizationId = await context.getOrganization(context, flags, {});
  const projectId = await context.getProject(context, flags, { organizationId });
  const branchId = await context.getBranch(context, flags, { organizationId, projectId, branchName });

  const branch = await context.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
  });

  if (branch.status.statusType !== 'STATUS_TYPE_HEALTHY') {
    const wakeHint = `${CLI_NAME} branch wait-ready ${branch.name} --wake`;
    context.process.stderr.write(
      chalk.yellow(
        `Branch ${branch.name} is not ready for query insights (statusType=${branch.status.statusType}). Use \`${wakeHint}\` and try again.\n`
      )
    );
    context.process.exitCode = 1;
    return undefined;
  }

  return { organizationId, projectId, branchId, branch };
}

export function buildQueryInsightsEnableCommand(branchName?: string) {
  return `${CLI_NAME} branch query-insights enable${branchName ? ` ${branchName}` : ''}`;
}

export async function executeQuery<T>(sql: postgres.Sql, query: RawBuilder<unknown>) {
  const compiled = compileSql(query);
  return sql.unsafe<T[]>(compiled.sql, compiled.parameters as any[]);
}

async function ensurePgStatStatementsUsable(context: LocalContext, sql: postgres.Sql, branchName: string) {
  const statusRows = await executeQuery<{
    available: boolean;
    installed: boolean;
    preloaded: boolean;
    sharedPreloadLibraries: string;
  }>(sql, getPgStatStatementsStatus.fn());
  const status = statusRows[0];

  if (!status?.available) {
    context.process.stderr.write(
      chalk.red(`${PG_STAT_STATEMENTS_EXTENSION} is not available for this branch image/region.\n`)
    );
    context.process.exitCode = 1;
    return false;
  }

  if (!status.preloaded || !status.installed) {
    const enableCommand = buildQueryInsightsEnableCommand(branchName);
    context.process.stderr.write(
      chalk.yellow(
        `${[
          `Query insights require ${PG_STAT_STATEMENTS_EXTENSION} to be enabled on this branch.`,
          `Run \`${enableCommand}\` and try again.`,
          `If the command updates preload libraries, wait for the branch with \`${CLI_NAME} branch wait-ready ${branchName} --wake\`.`
        ].join('\n')}\n`
      )
    );
    context.process.exitCode = 1;
    return false;
  }

  try {
    await executeQuery(sql, checkPgStatStatementsUsable());
  } catch (error) {
    context.process.stderr.write(chalk.red(`${formatQueryInsightsError(error)}\n`));
    context.process.exitCode = 1;
    return false;
  }

  return true;
}

export function formatQueryInsightsError(error: unknown) {
  const message = getErrorMessage(error);
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined;

  if (code === '42501' || /permission denied/i.test(message) || /must be superuser/i.test(message)) {
    if (/pg_stat_statements_reset/i.test(message)) {
      return `Permission denied: resetting query insights requires permission to execute pg_stat_statements_reset(). Original error: ${message}`;
    }
    return `Permission denied while accessing query insights. Original error: ${message}`;
  }

  if (message.includes('pg_stat_statements')) {
    return `Query insights require ${PG_STAT_STATEMENTS_EXTENSION} to be enabled on the branch. Original error: ${message}`;
  }
  return message;
}
