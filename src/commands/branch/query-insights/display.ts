import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { CLI_NAME } from '~/lib/constants';
import { renderTable } from '~/lib/table';
import {
  formatCacheHitRate,
  formatInteger,
  formatMilliseconds,
  getQueryPreviewLength,
  normalizeQueryForPreview,
  truncate
} from './format';
import type { QueryInsightRow } from './types';

export type QueryInsightSignal = {
  level: 'warning' | 'critical';
  label: string;
  reason: string;
};

type RenderQueryInsightsTableOptions = {
  wide: boolean;
  queryPreviewMaxLength?: number;
  selectedIndex?: number;
  includeSelector?: boolean;
  queryFocused?: boolean;
};

type PrintQueryInsightsTableOptions = RenderQueryInsightsTableOptions & {
  total: number;
  limit: number;
  offset: number;
};

const DEFAULT_QUERY_PREVIEW_MAX_LENGTH = 120;
const DEFAULT_WIDE_QUERY_PREVIEW_MAX_LENGTH = 160;

export function renderQueryInsightsTable(
  context: LocalContext,
  rows: QueryInsightRow[],
  options: RenderQueryInsightsTableOptions
) {
  const includeSignals = rows.some((row) => getQueryInsightSignals(row).length > 0);
  const headers = getQueryInsightsHeaders(options.wide, {
    includeSelector: options.includeSelector ?? false,
    includeSignals,
    queryFocused: options.queryFocused ?? false
  });
  const rowsWithoutQuery = rows.map((row, index) =>
    options.wide
      ? toWideRowCells(row, {
          selected: index === options.selectedIndex,
          includeSelector: options.includeSelector ?? false,
          includeSignals
        })
      : options.queryFocused
        ? toQueryFocusedRowCells(row, {
            selected: index === options.selectedIndex,
            includeSelector: options.includeSelector ?? false,
            includeSignals
          })
        : toNarrowRowCells(row, {
            selected: index === options.selectedIndex,
            includeSelector: options.includeSelector ?? false,
            includeSignals
          })
  );
  const queryPreviewLength = getQueryPreviewLength(
    context,
    headers,
    rowsWithoutQuery,
    options.queryPreviewMaxLength ??
      (options.wide ? DEFAULT_WIDE_QUERY_PREVIEW_MAX_LENGTH : DEFAULT_QUERY_PREVIEW_MAX_LENGTH)
  );

  return renderTable(
    headers,
    rows.map((row, index) => [
      ...rowsWithoutQuery[index]!,
      truncate(normalizeQueryForPreview(row.query), queryPreviewLength)
    ])
  );
}

export function printQueryInsightsTable(
  context: LocalContext,
  rows: QueryInsightRow[],
  options: PrintQueryInsightsTableOptions
) {
  context.process.stdout.write(`${renderQueryInsightsTable(context, rows, options)}\n`);
  printPaginationSummary(context, rows.length, options.total, options.limit, options.offset);
  printPotentialIssues(context, rows);

  if (rows.length > 0) {
    context.process.stdout.write(
      `\nTip: use \`${CLI_NAME} branch query-insights list --output tui\` to inspect queries interactively, or \`${CLI_NAME} branch query-insights show <queryid> --db <db> --role <role>\` to view the full query.\n`
    );
  }
}

export function renderQueryInsightDetails(row: QueryInsightRow) {
  const details = renderTable(
    ['Query ID', 'Calls', 'Total', 'Mean', 'Min', 'Max', 'Rows', 'Cache Hit', 'DB', 'User'],
    [
      [
        row.queryid,
        formatInteger(row.calls),
        formatMilliseconds(row.total_exec_time),
        formatMilliseconds(row.mean_exec_time),
        formatMilliseconds(row.min_exec_time),
        formatMilliseconds(row.max_exec_time),
        formatInteger(row.rows),
        formatCacheHitRate(row.cache_hit_rate),
        row.database,
        row.user
      ]
    ]
  );
  const signals = getQueryInsightSignals(row);
  const signalSummary = signals.length > 0 ? `\n${chalk.bold('Potential issues')}\n${formatSignals(signals)}\n` : '';
  return `${details}\n${signalSummary}\n${chalk.bold('Query')}\n${row.query}\n`;
}

export function printQueryInsightDetails(context: LocalContext, row: QueryInsightRow) {
  context.process.stdout.write(renderQueryInsightDetails(row));
}

export function getQueryInsightSignals(row: QueryInsightRow): QueryInsightSignal[] {
  const signals: QueryInsightSignal[] = [];
  if (row.mean_exec_time >= 1000) {
    signals.push({
      level: 'critical',
      label: 'slow mean',
      reason: `mean execution time ${formatMilliseconds(row.mean_exec_time)}`
    });
  } else if (row.mean_exec_time >= 100) {
    signals.push({
      level: 'warning',
      label: 'slow mean',
      reason: `mean execution time ${formatMilliseconds(row.mean_exec_time)}`
    });
  }

  if (row.mean_exec_time > 0 && row.max_exec_time >= 1000 && row.max_exec_time >= row.mean_exec_time * 5) {
    signals.push({
      level: 'warning',
      label: 'latency spikes',
      reason: `max ${formatMilliseconds(row.max_exec_time)} is much higher than mean`
    });
  }

  const sharedBlocks = row.shared_blks_hit + row.shared_blks_read;
  if (sharedBlocks >= 100 && row.cache_hit_rate !== null && row.cache_hit_rate !== undefined) {
    if (row.cache_hit_rate < 70) {
      signals.push({
        level: 'critical',
        label: 'low cache hit',
        reason: `cache hit rate ${formatCacheHitRate(row.cache_hit_rate)}`
      });
    } else if (row.cache_hit_rate < 90) {
      signals.push({
        level: 'warning',
        label: 'low cache hit',
        reason: `cache hit rate ${formatCacheHitRate(row.cache_hit_rate)}`
      });
    }
  }

  const tempBlocks = row.temp_blks_read + row.temp_blks_written;
  if (tempBlocks >= 10_000) {
    signals.push({
      level: 'critical',
      label: 'temp I/O',
      reason: `${formatInteger(tempBlocks)} temporary blocks read/written`
    });
  } else if (tempBlocks > 0) {
    signals.push({
      level: 'warning',
      label: 'temp I/O',
      reason: `${formatInteger(tempBlocks)} temporary blocks read/written`
    });
  }

  if (row.calls > 0 && row.rows / row.calls >= 10_000) {
    signals.push({
      level: 'warning',
      label: 'many rows',
      reason: `${formatInteger(Math.round(row.rows / row.calls))} rows per call`
    });
  }

  return signals;
}

function getQueryInsightsHeaders(
  wide: boolean,
  options: { includeSelector: boolean; includeSignals: boolean; queryFocused: boolean }
) {
  const headers = options.queryFocused
    ? ['Query ID', 'Calls', 'Mean', 'DB/User', 'Query']
    : wide
      ? [
          'Query ID',
          'Calls',
          'Total',
          'Mean',
          'Min',
          'Max',
          'Stddev',
          'Rows',
          'Cache Hit',
          'Shr Hit',
          'Shr Read',
          'Shr Dirt',
          'Shr Wr',
          'Loc Hit',
          'Loc Read',
          'Loc Dirt',
          'Loc Wr',
          'Tmp Read',
          'Tmp Wr',
          'DB',
          'User',
          'Query'
        ]
      : ['Query ID', 'Calls', 'Total', 'Mean', 'Rows', 'Cache Hit', 'DB', 'User', 'Query'];
  const prefixHeaders = [options.includeSelector ? '' : undefined, options.includeSignals ? '!' : undefined].filter(
    (header): header is string => header !== undefined
  );
  return [...prefixHeaders, ...headers];
}

function toQueryFocusedRowCells(
  row: QueryInsightRow,
  options: { selected: boolean; includeSelector: boolean; includeSignals: boolean }
) {
  return [
    ...toPrefixCells(row, options),
    row.queryid,
    formatInteger(row.calls),
    formatMaybeSlowMilliseconds(row.mean_exec_time),
    truncate(`${row.database}/${row.user}`, 24)
  ];
}

function toNarrowRowCells(
  row: QueryInsightRow,
  options: { selected: boolean; includeSelector: boolean; includeSignals: boolean }
) {
  return [
    ...toPrefixCells(row, options),
    row.queryid,
    formatInteger(row.calls),
    formatMilliseconds(row.total_exec_time),
    formatMaybeSlowMilliseconds(row.mean_exec_time),
    formatInteger(row.rows),
    formatMaybeLowCacheHitRate(row),
    row.database,
    row.user
  ];
}

function toWideRowCells(
  row: QueryInsightRow,
  options: { selected: boolean; includeSelector: boolean; includeSignals: boolean }
) {
  return [
    ...toPrefixCells(row, options),
    row.queryid,
    formatInteger(row.calls),
    formatMilliseconds(row.total_exec_time),
    formatMaybeSlowMilliseconds(row.mean_exec_time),
    formatMilliseconds(row.min_exec_time),
    formatMaybeSlowMilliseconds(row.max_exec_time),
    formatMilliseconds(row.stddev_exec_time),
    formatInteger(row.rows),
    formatMaybeLowCacheHitRate(row),
    formatInteger(row.shared_blks_hit),
    formatInteger(row.shared_blks_read),
    formatInteger(row.shared_blks_dirtied),
    formatInteger(row.shared_blks_written),
    formatInteger(row.local_blks_hit),
    formatInteger(row.local_blks_read),
    formatInteger(row.local_blks_dirtied),
    formatInteger(row.local_blks_written),
    formatMaybeTempBlocks(row.temp_blks_read),
    formatMaybeTempBlocks(row.temp_blks_written),
    row.database,
    row.user
  ];
}

function toPrefixCells(
  row: QueryInsightRow,
  options: { selected: boolean; includeSelector: boolean; includeSignals: boolean }
) {
  const signals = getQueryInsightSignals(row);
  const severity = signals.some((signal) => signal.level === 'critical')
    ? chalk.red('!')
    : signals.length > 0
      ? chalk.yellow('!')
      : '';
  return [
    options.includeSelector ? (options.selected ? chalk.cyan('›') : ' ') : undefined,
    options.includeSignals ? severity : undefined
  ].filter((cell): cell is string => cell !== undefined);
}

function formatMaybeSlowMilliseconds(value: number) {
  const formatted = formatMilliseconds(value);
  if (value >= 1000) return chalk.red(formatted);
  if (value >= 100) return chalk.yellow(formatted);
  return formatted;
}

function formatMaybeLowCacheHitRate(row: QueryInsightRow) {
  const formatted = formatCacheHitRate(row.cache_hit_rate);
  const sharedBlocks = row.shared_blks_hit + row.shared_blks_read;
  if (sharedBlocks < 100 || row.cache_hit_rate === null || row.cache_hit_rate === undefined) return formatted;
  if (row.cache_hit_rate < 70) return chalk.red(formatted);
  if (row.cache_hit_rate < 90) return chalk.yellow(formatted);
  return formatted;
}

function formatMaybeTempBlocks(value: number) {
  const formatted = formatInteger(value);
  if (value >= 10_000) return chalk.red(formatted);
  if (value > 0) return chalk.yellow(formatted);
  return formatted;
}

function printPaginationSummary(context: LocalContext, rowCount: number, total: number, limit: number, offset: number) {
  const start = rowCount === 0 ? 0 : offset + 1;
  const end = offset + rowCount;
  context.process.stdout.write(
    `\nShowing ${formatInteger(start)}-${formatInteger(end)} of ${formatInteger(total)} queries.\n`
  );
  if (end < total) {
    context.process.stdout.write(
      `Next page: ${CLI_NAME} branch query-insights list --offset ${offset + limit} --limit ${limit}\n`
    );
  }
}

function printPotentialIssues(context: LocalContext, rows: QueryInsightRow[]) {
  const notableRows = rows
    .map((row) => ({ row, signals: getQueryInsightSignals(row) }))
    .filter(({ signals }) => signals.length > 0)
    .sort((a, b) => scoreSignals(b.signals) - scoreSignals(a.signals))
    .slice(0, 5);

  if (notableRows.length === 0) return;

  context.process.stdout.write(`\n${chalk.bold('Potential issues:')}\n`);
  for (const { row, signals } of notableRows) {
    context.process.stdout.write(
      `- ${row.queryid} ${row.database}/${row.user}: ${formatSignals(signals)}\n  View: ${CLI_NAME} branch query-insights show ${row.queryid} --db ${row.database} --role ${row.user}\n`
    );
  }
}

function scoreSignals(signals: QueryInsightSignal[]) {
  return signals.reduce((total, signal) => total + (signal.level === 'critical' ? 2 : 1), 0);
}

function formatSignals(signals: QueryInsightSignal[]) {
  return signals.map((signal) => signal.reason).join('; ');
}
