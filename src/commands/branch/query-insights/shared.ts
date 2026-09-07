import type { Types } from '@xata.io/api';
import { fetchBranchConnectionString, PG_STAT_STATEMENTS_EXTENSION } from '@xata.io/sql';
import chalk from 'chalk';
import type postgres from 'postgres';
import type { LocalContext } from '~/context';
import { CLI_NAME } from '~/lib/constants';
import {
  fetchPgStatStatementsReadiness,
  formatQueryInsightsError,
  QUERY_INSIGHTS_ADMIN_DATABASE
} from '~/lib/query-insights';

export { executeQuery, formatQueryInsightsError } from '~/lib/query-insights';

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
    { database: QUERY_INSIGHTS_ADMIN_DATABASE, endpointType: 'rw' }
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

async function ensurePgStatStatementsUsable(context: LocalContext, sql: postgres.Sql, branchName: string) {
  const readiness = await fetchPgStatStatementsReadiness(sql);

  if (readiness.state === 'ready') return true;

  if (readiness.state === 'unavailable') {
    context.process.stderr.write(
      chalk.red(`${PG_STAT_STATEMENTS_EXTENSION} is not available for this branch image/region.\n`)
    );
  } else if (readiness.state === 'disabled') {
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
  } else {
    context.process.stderr.write(chalk.red(`${readiness.message}\n`));
  }

  context.process.exitCode = 1;
  return false;
}
