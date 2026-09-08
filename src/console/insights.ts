import { getQueryInsightSignals, type QueryInsightRow, type QueryInsightsSort } from '~/lib/query-insights';

export const INSIGHTS_SORTS = [
  'total-time',
  'mean-time',
  'max-time',
  'calls',
  'rows'
] as const satisfies readonly QueryInsightsSort[];

export type InsightsSort = (typeof INSIGHTS_SORTS)[number];

export function insightSeverityColor(row: QueryInsightRow): 'red' | 'yellow' | undefined {
  const signals = getQueryInsightSignals(row);
  if (signals.some((signal) => signal.level === 'critical')) return 'red';
  if (signals.length > 0) return 'yellow';
  return undefined;
}

export function wrapText(value: string, width: number): string[] {
  if (width <= 0) return [value];
  const lines: string[] = [];
  for (const rawLine of value.split('\n')) {
    if (rawLine.length === 0) {
      lines.push('');
      continue;
    }
    for (let start = 0; start < rawLine.length; start += width) {
      lines.push(rawLine.slice(start, start + width));
    }
  }
  return lines;
}
