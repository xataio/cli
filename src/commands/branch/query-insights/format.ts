import stripAnsi from 'strip-ansi';
import type { LocalContext } from '~/context';

export function formatCacheHitRate(rate: number | null | undefined) {
  return rate === null || rate === undefined ? '—' : `${rate.toFixed(1)}%`;
}

export function formatMilliseconds(value: number) {
  if (value < 1) return '0.0ms';
  if (value < 1000) return `${value.toFixed(1)}ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(1)}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

export function formatInteger(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

export function truncate(value: string, maxLength: number) {
  if (maxLength <= 0) return '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

export function normalizeQueryForPreview(query: string) {
  return query.replaceAll(/\s+/g, ' ').trim();
}

export function getQueryPreviewLength(
  context: LocalContext,
  headers: string[],
  rowsWithoutQuery: string[][],
  maxLength: number
) {
  const terminalWidth = context.process.stdout.columns || 120;
  const queryHeaderWidth = headers.at(-1)?.length ?? 0;
  const nonQueryWidth = headers.slice(0, -1).reduce((total, header, index) => {
    const cellWidth = rowsWithoutQuery.reduce((width, row) => Math.max(width, stripAnsi(row[index] ?? '').length), 0);
    return total + Math.max(header.length, cellWidth);
  }, 0);

  // Our shared table renderer uses borderless cli-table3 output with zero
  // padding and a single-space column separator.
  const bordersAndPaddingWidth = Math.max(0, headers.length - 1);
  const availableQueryWidth = terminalWidth - nonQueryWidth - bordersAndPaddingWidth;

  return Math.max(queryHeaderWidth, Math.min(maxLength, availableQueryWidth));
}
