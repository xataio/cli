import { buildCommand } from '@stricli/core';
import { DEFAULT_QUERY_INSIGHTS_LIMIT } from '@xata.io/sql';
import type { LocalContext } from '~/context';
import { printQueryInsightsTable } from './display';
import { parsePerformanceCategories, parseQueryTypes, parseStringFilter } from './filters';
import { listQueryInsights } from './queries';
import { withBranchQueryInsightsSql, type BranchQueryInsightsFlags } from './shared';
import { QUERY_INSIGHTS_SORT_VALUES, type QueryInsightsSort } from './sort';
import { runQueryInsightsListTui } from './tui';
import type { SortDirection } from './types';

const DEFAULT_HUMAN_QUERY_INSIGHTS_LIMIT = 50;

type OutputFormat = 'table' | 'json' | 'ndjson' | 'tui';

type Flags = BranchQueryInsightsFlags & {
  search?: string;
  type?: string;
  performance?: string;
  db?: string;
  role?: string;
  sort: QueryInsightsSort;
  direction: SortDirection;
  limit?: string;
  offset: string;
  wide: boolean;
  output: OutputFormat;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  const output = resolveOutputFormat(flags);
  if (output === 'tui' && !this.isInteractive) {
    throw new Error('--output tui requires an interactive terminal.');
  }

  const queryTypes = parseQueryTypes(flags.type);
  const performance = parsePerformanceCategories(flags.performance);
  const databases = parseStringFilter(flags.db);
  const users = parseStringFilter(flags.role);
  const limit = flags.limit
    ? parsePositiveInteger(flags.limit, 'limit')
    : output === 'json' || output === 'ndjson'
      ? DEFAULT_QUERY_INSIGHTS_LIMIT
      : DEFAULT_HUMAN_QUERY_INSIGHTS_LIMIT;
  const offset = parseNonNegativeInteger(flags.offset, 'offset');
  const listOptions = {
    search: flags.search,
    queryTypes,
    performance,
    databases,
    users,
    sort: flags.sort,
    direction: flags.direction,
    limit,
    offset
  };

  if (output === 'tui') {
    await withBranchQueryInsightsSql(this, flags, branchName, async (sql) => {
      const result = await listQueryInsights(sql, listOptions);
      await runQueryInsightsListTui(
        this,
        { total: result.total, limit, offset, rows: result.rows, wide: flags.wide },
        async (nextOffset) => {
          const nextResult = await listQueryInsights(sql, { ...listOptions, offset: nextOffset });
          return { total: nextResult.total, offset: nextOffset, rows: nextResult.rows };
        }
      );
    });
    return;
  }

  const result = await withBranchQueryInsightsSql(this, flags, branchName, async (sql) =>
    listQueryInsights(sql, listOptions)
  );

  if (!result) return;

  const outputValue = {
    total: result.total,
    limit,
    offset,
    queries: result.rows
  };

  if (output === 'json') {
    this.print(this, true, outputValue);
    return;
  }

  if (output === 'ndjson') {
    this.process.stdout.write(`${JSON.stringify(outputValue)}\n`);
    return;
  }

  printQueryInsightsTable(this, result.rows, { total: result.total, limit, offset, wide: flags.wide });
}

export const QueryInsightsListCommand = buildCommand({
  docs: {
    brief: 'List historical query statistics for a branch'
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
      search: {
        kind: 'parsed',
        brief: 'Search query text, database, or role',
        parse: String,
        optional: true
      },
      type: {
        kind: 'parsed',
        brief: 'Comma-separated query types: SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, OTHER',
        parse: String,
        optional: true
      },
      performance: {
        kind: 'parsed',
        brief: 'Comma-separated performance categories: fast, moderate, slow',
        parse: String,
        optional: true
      },
      db: {
        kind: 'parsed',
        brief: 'Comma-separated database names to include',
        parse: String,
        optional: true
      },
      role: {
        kind: 'parsed',
        brief: 'Comma-separated role names to include',
        parse: String,
        optional: true
      },
      sort: {
        kind: 'enum',
        values: QUERY_INSIGHTS_SORT_VALUES,
        brief: 'Sort by a query insight metric or dimension',
        default: 'total-time'
      },
      direction: {
        kind: 'enum',
        values: ['asc', 'desc'],
        brief: 'Sort direction',
        default: 'desc'
      },
      limit: {
        kind: 'parsed',
        brief: 'Maximum number of rows to return. Defaults to 50 for human output and 1000 for --json.',
        parse: String,
        optional: true
      },
      offset: {
        kind: 'parsed',
        brief: 'Number of rows to skip',
        parse: String,
        default: '0'
      },
      wide: {
        kind: 'boolean',
        brief: 'Show all pg_stat_statements metrics in human output',
        default: false
      },
      output: {
        kind: 'enum',
        values: ['table', 'json', 'ndjson', 'tui'],
        brief: 'Output format',
        default: 'table'
      },
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format. Alias for --output json.',
        default: false
      }
    },
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'The branch to inspect',
          parse: String,
          placeholder: 'branch name',
          optional: true
        }
      ]
    },
    aliases: {
      o: 'output',
      w: 'wide'
    }
  },
  func: implementation
});

function resolveOutputFormat(flags: Pick<Flags, 'json' | 'output'>): OutputFormat {
  return flags.json ? 'json' : flags.output;
}

function parsePositiveInteger(value: string, label: string) {
  const number = parseNonNegativeInteger(value, label);
  if (number < 1) {
    throw new Error(`--${label} must be greater than 0.`);
  }
  return number;
}

function parseNonNegativeInteger(value: string, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`--${label} must be a non-negative integer.`);
  }
  return number;
}
