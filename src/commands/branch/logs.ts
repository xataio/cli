import { buildCommand } from '@stricli/core';
import type { Types } from '@xata.io/api';
import {
  BRANCH_LOG_LEVELS,
  BRANCH_LOG_MAX_BODY_FILTER_LENGTH,
  BRANCH_LOG_MAX_FILTER_VALUES,
  BRANCH_LOG_MAX_LIMIT,
  branchLogFingerprint,
  buildBranchLogFilters,
  sortBranchLogsChronologically
} from '@xata.io/utils';
import type { BranchLogLevel } from '@xata.io/utils';
import type { LocalContext } from '~/context';

const DEFAULT_LIMIT = 100;
const FOLLOW_POLL_INTERVAL_MS = 2_000;
const FOLLOW_OVERLAP_MS = 5_000;
const DATE_FLAG_FORMAT = 'YYYY-MM-DDTHH:mm:ss.sssZ';
const DATE_FLAG_EXAMPLE = '2026-05-23T10:00:00.000Z';
const DATE_FLAG_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

type OutputFormat = 'raw' | 'json' | 'ndjson' | 'csv';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  level?: BranchLogLevel[];
  instance?: string[];
  process?: string[];
  search?: string;
  start?: string;
  end?: string;
  limit: number;
  follow: boolean;
  output: OutputFormat;
  json: boolean;
};

type TimeRange = {
  start: string;
  end: string;
};

const relativeTimePattern = /^(\d+)(ms|s|m|h|d|w)$/;
const relativeTimeMultipliers: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000
};

function invalidTimeError(value: string, flagName: 'start' | 'end') {
  return new Error(
    `Invalid --${flagName} time: ${value}. Use format ${DATE_FLAG_FORMAT}, for example ${DATE_FLAG_EXAMPLE}, or a relative duration like 15m, 1h, or 7d.`
  );
}

export function parseLogTime(value: string, flagName: 'start' | 'end', now = new Date()): string {
  const relative = relativeTimePattern.exec(value);
  if (relative) {
    const amount = relative[1];
    const unit = relative[2];
    if (!amount || !unit) {
      throw invalidTimeError(value, flagName);
    }
    const multiplier = relativeTimeMultipliers[unit];
    if (!multiplier) {
      throw invalidTimeError(value, flagName);
    }
    return new Date(now.getTime() - Number(amount) * multiplier).toISOString();
  }

  if (!DATE_FLAG_PATTERN.test(value)) {
    throw invalidTimeError(value, flagName);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw invalidTimeError(value, flagName);
  }
  return parsed.toISOString();
}

export function buildTimeRange(flags: Pick<Flags, 'start' | 'end'>, now = new Date()): TimeRange {
  const end = flags.end ? parseLogTime(flags.end, 'end', now) : now.toISOString();
  const start = flags.start
    ? parseLogTime(flags.start, 'start', now)
    : new Date(now.getTime() - 3_600_000).toISOString();

  if (new Date(start).getTime() >= new Date(end).getTime()) {
    throw new Error('Start time must be before end time.');
  }

  return { start, end };
}

function validateFilterValues(name: string, values: string[]) {
  if (values.length > BRANCH_LOG_MAX_FILTER_VALUES) {
    throw new Error(`Too many --${name} values. Use at most ${BRANCH_LOG_MAX_FILTER_VALUES}.`);
  }
}

export function buildFilters(flags: Pick<Flags, 'level' | 'instance' | 'process' | 'search'>): Types.LogFilter[] {
  const levels = flags.level ?? [];
  const instances = flags.instance ?? [];
  const processes = flags.process ?? [];

  validateFilterValues('level', levels);
  validateFilterValues('instance', instances);
  validateFilterValues('process', processes);

  if (flags.search && flags.search.length > BRANCH_LOG_MAX_BODY_FILTER_LENGTH) {
    throw new Error(`--search must be ${BRANCH_LOG_MAX_BODY_FILTER_LENGTH} characters or fewer.`);
  }

  return buildBranchLogFilters({ levels, instances, processes, body: flags.search });
}

function parseLimit(value: string): number {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > BRANCH_LOG_MAX_LIMIT) {
    throw new Error(`--limit must be an integer between 1 and ${BRANCH_LOG_MAX_LIMIT}.`);
  }
  return limit;
}

function resolveOutputFormat(flags: Pick<Flags, 'json' | 'output'>): OutputFormat {
  return flags.json ? 'json' : flags.output;
}

export function formatRawLog(log: Types.LogEntry): string {
  const metadata = [log.level, log.instanceID, log.process].filter(Boolean).join(' ');
  return `${log.timestamp} ${metadata ? `[${metadata}] ` : ''}${log.message}`;
}

function formatRawLogs(logs: Types.LogEntry[]): string {
  return logs.map(formatRawLog).join('\n');
}

function formatCsvValue(value: string | null | undefined): string {
  return `"${(value ?? '').replace(/"/g, '""')}"`;
}

export function formatCsvLogs(logs: Types.LogEntry[], includeHeader = true): string {
  const rows = logs.map((log) =>
    [log.timestamp, log.level, log.instanceID, log.process, log.message].map(formatCsvValue).join(',')
  );
  return [...(includeHeader ? ['timestamp,level,instanceID,process,message'] : []), ...rows].join('\n');
}

function writeLogs(
  context: LocalContext,
  logs: Types.LogEntry[],
  output: OutputFormat,
  options = { includeCsvHeader: true }
) {
  if (logs.length === 0 && output !== 'json' && !(output === 'csv' && options.includeCsvHeader)) return;

  if (output === 'json') {
    context.process.stdout.write(`${JSON.stringify(logs, null, 2)}\n`);
    return;
  }

  if (output === 'ndjson') {
    for (const log of logs) {
      context.process.stdout.write(`${JSON.stringify(log)}\n`);
    }
    return;
  }

  if (output === 'csv') {
    context.process.stdout.write(`${formatCsvLogs(logs, options.includeCsvHeader)}\n`);
    return;
  }

  context.process.stdout.write(`${formatRawLogs(logs)}\n`);
}

export function pruneSeenLogs(seen: Map<string, number>, minTimestamp: number) {
  for (const [fingerprint, timestamp] of seen) {
    if (timestamp < minTimestamp) {
      seen.delete(fingerprint);
    }
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchLogs(
  context: LocalContext,
  options: {
    organizationId: string;
    projectId: string;
    branchId: string;
    timeRange: TimeRange;
    filters: Types.LogFilter[];
    limit: number;
  }
) {
  const logs: Types.LogEntry[] = [];
  let cursor: string | null | undefined;

  do {
    const remaining = options.limit - logs.length;
    const response = await context.api.branches.branchLogs({
      pathParams: {
        organizationID: options.organizationId,
        projectID: options.projectId,
        branchID: options.branchId
      },
      body: {
        start: options.timeRange.start,
        end: options.timeRange.end,
        limit: Math.min(remaining, BRANCH_LOG_MAX_LIMIT),
        ...(options.filters.length > 0 && { filters: options.filters }),
        ...(cursor && { cursor })
      }
    });

    logs.push(...response.logs.slice(0, remaining));
    cursor = response.nextCursor;
  } while (cursor && logs.length < options.limit);

  return sortBranchLogsChronologically(logs);
}

function normalizeLogsError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (/404|not found|not available|disabled/i.test(message)) {
    throw new Error('Branch logs are not available for this branch.');
  }
  throw error;
}

async function runSnapshot(
  context: LocalContext,
  options: {
    organizationId: string;
    projectId: string;
    branchId: string;
    timeRange: TimeRange;
    filters: Types.LogFilter[];
    limit: number;
    output: OutputFormat;
  }
) {
  try {
    const logs = await fetchLogs(context, options);
    writeLogs(context, logs, options.output);
  } catch (error) {
    normalizeLogsError(error);
  }
}

async function runFollow(
  context: LocalContext,
  options: {
    organizationId: string;
    projectId: string;
    branchId: string;
    timeRange: TimeRange;
    filters: Types.LogFilter[];
    limit: number;
    output: Exclude<OutputFormat, 'json'>;
  }
) {
  const seen = new Map<string, number>();
  let nextStart = options.timeRange.start;
  let firstPoll = true;
  let includeCsvHeader = options.output === 'csv';

  while (true) {
    const pollRange = { start: nextStart, end: firstPoll ? options.timeRange.end : new Date().toISOString() };
    let logs: Types.LogEntry[];

    try {
      logs = await fetchLogs(context, { ...options, timeRange: pollRange });
    } catch (error) {
      normalizeLogsError(error);
    }

    let newestTimestamp = new Date(nextStart).getTime();
    const unseen = logs.filter((log) => {
      const logTimestamp = new Date(log.timestamp).getTime();
      newestTimestamp = Math.max(newestTimestamp, logTimestamp);
      const fingerprint = branchLogFingerprint(log);
      if (seen.has(fingerprint)) return false;
      seen.set(fingerprint, logTimestamp);
      return true;
    });

    writeLogs(context, unseen, options.output, { includeCsvHeader });
    includeCsvHeader = false;
    const nextStartTimestamp = Math.max(0, newestTimestamp - FOLLOW_OVERLAP_MS);
    pruneSeenLogs(seen, nextStartTimestamp);
    nextStart = new Date(nextStartTimestamp).toISOString();
    firstPoll = false;
    await sleep(FOLLOW_POLL_INTERVAL_MS);
  }
}

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  const output = resolveOutputFormat(flags);
  if (flags.follow && output === 'json') {
    throw new Error('Cannot use --follow with JSON array output. Use --output ndjson, --output csv, or --output raw.');
  }

  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId, branchName });
  const timeRange = buildTimeRange(flags);
  const filters = buildFilters(flags);

  const options = {
    organizationId,
    projectId,
    branchId,
    timeRange,
    filters,
    limit: flags.limit,
    output
  };

  if (flags.follow) {
    await runFollow(this, { ...options, output: output as Exclude<OutputFormat, 'json'> });
    return;
  }

  await runSnapshot(this, options);
}

export const BranchLogsCommand = buildCommand({
  docs: {
    brief: 'Retrieve the PostgreSQL logs of a branch',
    fullDescription:
      'Reads the logs of every instance of the branch, the primary and any replicas, which is where slow queries, connection issues and replication problems show up. Requires the `logs:read` scope on the API key. Of the output formats, `raw` prints `<timestamp> [<level> <instanceID> <process>] <message>` per line, `json` a single array, `ndjson` one object per line for streaming into another process, and `csv` the columns `timestamp,level,instanceID,process,message`. Follow mode polls every 2 seconds with a 5 second overlap and de-duplicates entries. Logs can contain connection strings and other credentials, see https://xata.io/docs/platform/logs for what is redacted.',
    customUsage: [
      { input: 'my-branch --level error --start 15m', brief: 'Errors from the last 15 minutes' },
      {
        input: `my-branch -f --output ndjson | jq -r 'select(.level=="error") | .message'`,
        brief: 'Follow errors and pull out the message text'
      },
      {
        input: `my-branch --output raw | rg 'timeout|deadlock'`,
        brief: 'Regex search, which --search does not do, by piping raw output'
      },
      {
        input: 'my-branch --process postgres --instance <replica-id> --output csv > logs.csv',
        brief: "Export one replica's Postgres process logs to a file"
      }
    ]
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
      level: {
        kind: 'enum',
        values: [...BRANCH_LOG_LEVELS],
        brief: 'Filter by log level. Can be repeated.',
        optional: true,
        variadic: true
      },
      instance: {
        kind: 'parsed',
        brief: 'Filter by branch instance ID. Can be repeated.',
        parse: String,
        optional: true,
        variadic: true
      },
      process: {
        kind: 'parsed',
        brief: 'Filter by process name. Can be repeated.',
        parse: String,
        optional: true,
        variadic: true
      },
      search: {
        kind: 'parsed',
        brief:
          "Case-insensitive substring search in the log message body. For regex filtering, pipe raw output to rg/grep, e.g. xata branch logs --output raw | rg 'timeout|deadlock'",
        parse: String,
        optional: true
      },
      start: {
        kind: 'parsed',
        brief: `Start time as ${DATE_FLAG_FORMAT} or relative duration, e.g. 15m, 1h, 7d. Defaults to 1h ago.`,
        parse: String,
        optional: true
      },
      end: {
        kind: 'parsed',
        brief: `End time as ${DATE_FLAG_FORMAT} or relative duration. Defaults to now.`,
        parse: String,
        optional: true
      },
      limit: {
        kind: 'parsed',
        brief: `Maximum number of logs to fetch, up to ${BRANCH_LOG_MAX_LIMIT}`,
        parse: parseLimit,
        default: String(DEFAULT_LIMIT)
      },
      follow: {
        kind: 'boolean',
        brief: 'Poll for new logs continuously. Cannot be combined with --output json',
        default: false
      },
      output: {
        kind: 'enum',
        values: ['raw', 'json', 'ndjson', 'csv'],
        brief: 'Output format',
        default: 'raw'
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
          brief: 'The branch to retrieve logs for',
          parse: String,
          placeholder: 'branch',
          optional: true
        }
      ]
    },
    aliases: {
      o: 'output',
      f: 'follow'
    }
  },
  func: implementation
});
