import type { Types } from '@xata.io/api';
import type { BranchLogLevel } from '@xata.io/utils';

export const LOG_BUFFER_LIMIT = 500;

export const LOG_LEVEL_FILTERS = ['all', 'error', 'warning', 'info', 'debug'] as const;

export type LogLevelFilter = (typeof LOG_LEVEL_FILTERS)[number];

export function logLevelsForFilter(filter: LogLevelFilter): BranchLogLevel[] {
  return filter === 'all' ? [] : [filter];
}

export function appendLogs(
  buffer: Types.LogEntry[],
  incoming: Types.LogEntry[],
  limit = LOG_BUFFER_LIMIT
): Types.LogEntry[] {
  if (incoming.length === 0) return buffer;
  const merged = [...buffer, ...incoming];
  return merged.length > limit ? merged.slice(merged.length - limit) : merged;
}

export function logLevelColor(level: string | null | undefined): string {
  if (level === 'error') return 'red';
  if (level === 'warning') return 'yellow';
  if (level === 'debug') return 'gray';
  return 'white';
}

export function formatLogTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString('en-GB', { hour12: false });
}
