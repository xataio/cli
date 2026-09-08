import type { BranchMetricAggregation, BranchMetricsReport } from '@xata.io/utils';
import { formatBranchMetricValue } from '@xata.io/utils';

export const METRIC_SINCE_OPTIONS = ['1h', '6h', '24h', '7d'] as const;

export type MetricSince = (typeof METRIC_SINCE_OPTIONS)[number];

export type MetricRow =
  | {
      kind: 'data';
      key: string;
      title: string;
      instanceName: string;
      latest: string;
      min: string;
      max: string;
      avg: string;
      ratio: number;
    }
  | {
      kind: 'status';
      key: string;
      title: string;
      status: string;
    };

export function buildMetricRows(report: BranchMetricsReport, aggregation: BranchMetricAggregation): MetricRow[] {
  const rows: MetricRow[] = [];

  const titleCounts = new Map<string, number>();
  for (const metric of report.metrics) {
    titleCounts.set(metric.title, (titleCounts.get(metric.title) ?? 0) + 1);
  }

  for (const metric of report.metrics) {
    const title =
      (titleCounts.get(metric.title) ?? 0) > 1 ? `${metric.title} (${metric.key.split('_').at(-1)})` : metric.title;
    const series = metric.series.filter((serie) => serie.aggregation === aggregation);

    if (metric.status !== 'ok' || series.length === 0) {
      rows.push({
        kind: 'status',
        key: metric.key,
        title,
        status: metric.status === 'config_required' ? `requires ${metric.requiredConfig}` : 'no data'
      });
      continue;
    }

    const windowMax = Math.max(0, ...series.map((serie) => serie.stats.max ?? 0));
    const normalizedMax = metric.unit === 'percentage' ? Math.max(windowMax, 1) : windowMax;

    for (const serie of series) {
      const latest = serie.latest?.value ?? null;
      rows.push({
        kind: 'data',
        key: metric.key,
        title,
        instanceName: serie.instanceName,
        latest: formatBranchMetricValue(latest, metric.unit),
        min: formatBranchMetricValue(serie.stats.min, metric.unit),
        max: formatBranchMetricValue(serie.stats.max, metric.unit),
        avg: formatBranchMetricValue(serie.stats.avg, metric.unit),
        ratio: latest === null || normalizedMax <= 0 ? 0 : Math.min(1, Math.max(0, latest / normalizedMax))
      });
    }
  }

  return rows;
}
