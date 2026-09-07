import stripAnsi from 'strip-ansi';
import type { LocalContext } from '~/context';

export {
  formatCacheHitRate,
  formatInteger,
  formatMilliseconds,
  normalizeQueryForPreview,
  truncate
} from '~/lib/query-insights';

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
