import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { getQueryPreviewLength, normalizeQueryForPreview, truncate } from './format';
import { listActiveQueries } from './queries';
import { withBranchQueryInsightsSql, type BranchQueryInsightsFlags } from './shared';
import type { ActiveQueryRow } from './types';
import { printCustom } from '~/lib/cli-utils';
import { renderTable } from '~/lib/table';

type Flags = BranchQueryInsightsFlags & {
  watch?: number;
};

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  if (flags.watch !== undefined && (!Number.isFinite(flags.watch) || flags.watch <= 0)) {
    this.process.stderr.write(chalk.red('--watch must be a finite number greater than 0 seconds.\n'));
    this.process.exitCode = 1;
    return;
  }

  // Only an outright --json conflicts, not the agent default.
  if (flags.watch !== undefined && this.json) {
    this.process.stderr.write(chalk.red('--watch cannot be used with --json.\n'));
    this.process.exitCode = 1;
    return;
  }

  await withBranchQueryInsightsSql(
    this,
    flags,
    branchName,
    async (sql) => {
      if (flags.watch === undefined) {
        const rows = await listActiveQueries(sql);
        printCustom(this, { queries: rows }, () => renderActiveQueries(this, rows));
        return;
      }

      while (true) {
        const rows = await listActiveQueries(sql);
        this.process.stdout.write('\x1b[2J\x1b[H');
        this.process.stdout.write(`${chalk.bold('Active queries')} (${new Date().toLocaleTimeString()})\n\n`);
        renderActiveQueries(this, rows);
        await new Promise((resolve) => setTimeout(resolve, flags.watch! * 1000));
      }
    },
    { requirePgStatStatements: false }
  );
}

function renderActiveQueries(context: LocalContext, rows: ActiveQueryRow[]) {
  const headers = ['PID', 'Age', 'State', 'Wait', 'DB', 'User', 'Client', 'Query'];
  const rowsWithoutQuery = rows.map((row) => [
    String(row.pid),
    formatAge(row.query_start),
    row.state,
    [row.wait_event_type, row.wait_event].filter(Boolean).join('/') || '—',
    row.datname,
    row.usename,
    row.client_addr ?? '—'
  ]);
  const queryPreviewLength = getQueryPreviewLength(context, headers, rowsWithoutQuery, 50);

  const table = renderTable(
    headers,
    rows.map((row, index) => [
      ...rowsWithoutQuery[index]!,
      truncate(normalizeQueryForPreview(row.query), queryPreviewLength)
    ])
  );
  context.process.stdout.write(`${table}\n`);
}

function formatAge(start: Date | string) {
  const startedAt = new Date(start).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export const QueryInsightsActiveCommand = buildCommand({
  docs: {
    brief: 'List currently running queries for a branch',
    fullDescription:
      'Reads `pg_stat_activity`, so it works without `pg_stat_statements` being loaded. The columns are PID, Age, State, Wait, DB, User, Client and Query.',
    customUsage: [{ input: 'my-branch --watch 5', brief: 'What is running right now, refreshed every 5 seconds' }]
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
      watch: {
        kind: 'parsed',
        brief: 'Refresh interval in seconds. Cannot be combined with --json',
        parse: Number,
        optional: true
      }
    },
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'The branch to inspect',
          parse: String,
          placeholder: 'branch',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
