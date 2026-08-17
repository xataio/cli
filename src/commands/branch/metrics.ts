import { buildCommand } from '@stricli/core';
import type { Types } from '@xata.io/api';
import {
  buildBranchMetricsReport,
  computeBranchInstanceName,
  formatBranchMetricValue,
  getBranchMetricConfig,
  isBranchMetricKey,
  resolveBranchMetricAggregations,
  resolveBranchMetricKeys,
  resolveBranchMetricTimeRange,
  type BranchMetricAggregation,
  type BranchMetricInstance,
  type BranchMetricKey,
  type BranchMetricRequiredConfig,
  type BranchMetricResult,
  type BranchMetricsReport
} from '@xata.io/utils';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { getErrorMessage } from '~/lib/cli-utils';
import { renderTable } from '~/lib/table';

type OutputFormat = 'table' | 'json' | 'ndjson' | 'tui';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  since?: string;
  start?: string;
  end?: string;
  metrics: string;
  instances: string;
  aggregations: string;
  aggregation: BranchMetricAggregation;
  refresh: string;
  output: OutputFormat;
  watch: boolean;
  json: boolean;
};

type MetricsTarget = {
  organizationId: string;
  projectId: string;
  branchId: string;
  branchName: string;
  instances: BranchMetricInstance[];
};

type SnapshotOptions = {
  target: MetricsTarget;
  metricKeys: BranchMetricKey[];
  aggregations: BranchMetricAggregation[];
  selectedAggregation: BranchMetricAggregation;
  instanceSelector: string;
  since?: string;
  start?: string;
  end?: string;
};

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  const metricKeys = resolveBranchMetricKeys(flags.metrics);
  const aggregations = ensureAggregationIncluded(
    resolveBranchMetricAggregations(flags.aggregations),
    flags.aggregation
  );
  const refreshMs = parseRefreshInterval(flags.refresh);
  const format = resolveOutputFormat(flags, this.isInteractive);

  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId, branchName });
  const branch = await this.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
  });

  const target: MetricsTarget = {
    organizationId,
    projectId,
    branchId,
    branchName: branch.name,
    instances: branch.status.instances.map((instance) => ({ id: instance.id, primary: instance.primary }))
  };

  const snapshotOptions: SnapshotOptions = {
    target,
    metricKeys,
    aggregations,
    selectedAggregation: flags.aggregation,
    instanceSelector: flags.instances,
    since: flags.since,
    start: flags.start,
    end: flags.end
  };

  if (!flags.watch) {
    const report = await fetchMetricsReport.call(this, snapshotOptions);
    writeReport(this, report, format, flags.aggregation);
    return;
  }

  await watchMetrics.call(this, snapshotOptions, { format, refreshMs });
}

async function fetchMetricsReport(this: LocalContext, options: SnapshotOptions): Promise<BranchMetricsReport> {
  const { target, metricKeys, aggregations, instanceSelector, since, start, end } = options;
  const timeRange = resolveBranchMetricTimeRange({ since, start, end });
  const selectedInstances = resolveInstances(target.instances, instanceSelector);
  const disabledConfigs = await getDisabledMetricConfigs(this, target);
  const metricResults: Partial<Record<BranchMetricKey, BranchMetricResult>> = {};

  if (selectedInstances.length > 0) {
    const enabledMetricKeys = metricKeys.filter((metric) => {
      const config = getBranchMetricConfig(metric);
      return !config.requiresConfig || !disabledConfigs.has(config.requiresConfig);
    });

    if (enabledMetricKeys.length > 0) {
      const response = await this.api.branches.branchMetrics({
        pathParams: {
          organizationID: target.organizationId,
          projectID: target.projectId,
          branchID: target.branchId
        },
        body: {
          start: timeRange.start,
          end: timeRange.end,
          metrics: enabledMetricKeys,
          instances: selectedInstances.map((instance) => instance.id),
          aggregations
        }
      });

      for (const result of response.results) {
        if (isBranchMetricKey(result.metric)) metricResults[result.metric] = result;
      }
    }
  }

  return buildBranchMetricsReport({
    organizationId: target.organizationId,
    projectId: target.projectId,
    branchId: target.branchId,
    branchName: target.branchName,
    start: timeRange.start,
    end: timeRange.end,
    instances: selectedInstances.map((instance) => ({
      ...instance,
      name: computeBranchInstanceName(instance, target.instances)
    })),
    metricKeys,
    metricResults,
    disabledConfigs
  });
}

async function getDisabledMetricConfigs(
  context: LocalContext,
  target: MetricsTarget
): Promise<ReadonlySet<BranchMetricRequiredConfig>> {
  try {
    const postgresConfig = await context.api.branches.getBranchPostgresConfig({
      pathParams: {
        organizationID: target.organizationId,
        projectID: target.projectId,
        branchID: target.branchId
      }
    });

    const disabled = new Set<BranchMetricRequiredConfig>();
    for (const configName of ['track_io_timing', 'track_wal_io_timing'] as const) {
      const parameter = postgresConfig.parameters.find((p: Types.PostgresConfigParameter) => p.name === configName);
      if (parameter?.currentValue !== 'on') disabled.add(configName);
    }
    return disabled;
  } catch {
    return new Set();
  }
}

function writeReport(
  context: LocalContext,
  report: BranchMetricsReport,
  format: OutputFormat,
  aggregation: BranchMetricAggregation
) {
  if (format === 'json') {
    context.process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  if (format === 'ndjson') {
    context.process.stdout.write(`${JSON.stringify(report)}\n`);
    return;
  }

  if (format === 'tui') {
    context.process.stdout.write(renderDashboard(report, aggregation));
    return;
  }

  context.process.stdout.write(renderSummaryTable(report, aggregation));
}

async function watchMetrics(
  this: LocalContext,
  options: SnapshotOptions,
  { format, refreshMs }: { format: OutputFormat; refreshMs: number }
) {
  while (true) {
    try {
      const report = await fetchMetricsReport.call(this, options);

      if (format === 'ndjson') {
        this.process.stdout.write(`${JSON.stringify(report)}\n`);
      } else if (format === 'json') {
        this.process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      } else {
        this.process.stdout.write('\x1b[2J\x1b[H');
        this.process.stdout.write(renderDashboard(report, options.selectedAggregation));
      }
    } catch (error) {
      this.process.stderr.write(chalk.yellow(`Failed to refresh branch metrics: ${getErrorMessage(error)}\n`));
    }

    await new Promise((resolve) => setTimeout(resolve, refreshMs));
  }
}

function renderSummaryTable(report: BranchMetricsReport, aggregation: BranchMetricAggregation): string {
  const rows: string[][] = [];

  for (const metric of report.metrics) {
    const series = metric.series.filter((s) => s.aggregation === aggregation);
    if (series.length === 0) {
      rows.push([
        metric.key,
        '',
        aggregation,
        '-',
        '-',
        '-',
        '-',
        metric.unit ?? '',
        formatMetricStatus(metric.status, metric.requiredConfig)
      ]);
      continue;
    }

    for (const serie of series) {
      rows.push([
        metric.key,
        serie.instanceName,
        serie.aggregation,
        formatBranchMetricValue(serie.latest?.value, metric.unit),
        formatBranchMetricValue(serie.stats.min, metric.unit),
        formatBranchMetricValue(serie.stats.max, metric.unit),
        formatBranchMetricValue(serie.stats.avg, metric.unit),
        metric.unit ?? '',
        formatMetricStatus(metric.status, metric.requiredConfig)
      ]);
    }
  }

  const table = renderTable(['Metric', 'Instance', 'Agg', 'Latest', 'Min', 'Max', 'Avg', 'Unit', 'Status'], rows);

  return `${chalk.bold(`Metrics for ${report.target.branchName} (${report.target.branchId})`)}\n${chalk.dim(
    `${report.timeRange.start} → ${report.timeRange.end}`
  )}\n${table}\n`;
}

function renderDashboard(report: BranchMetricsReport, aggregation: BranchMetricAggregation): string {
  const width = Math.max(80, process.stdout.columns || 100);
  const lines = [
    chalk.bold.cyan(`Xata branch metrics  ${report.target.branchName} (${report.target.branchId})`),
    chalk.dim(`${report.timeRange.start} → ${report.timeRange.end}  •  captured ${report.capturedAt}`),
    chalk.dim(`Aggregation: ${aggregation}  •  Ctrl+C to quit`),
    ''.padEnd(Math.min(width, 120), '─')
  ];

  for (const metric of report.metrics) {
    const series = metric.series.filter((s) => s.aggregation === aggregation);
    if (series.length === 0) {
      lines.push(
        `${chalk.bold(metric.key.padEnd(24))} ${chalk.dim(formatMetricStatus(metric.status, metric.requiredConfig))}`
      );
      continue;
    }

    const max = Math.max(0, ...series.map((serie) => serie.latest?.value ?? 0));
    lines.push(chalk.bold(metric.key));
    for (const serie of series) {
      const latest = serie.latest?.value ?? null;
      lines.push(
        `  ${serie.instanceName.padEnd(12)} ${renderBar(latest, max, metric.unit)} ${formatBranchMetricValue(
          latest,
          metric.unit
        )}`
      );
    }
  }

  lines.push('');
  lines.push(chalk.dim(`Instances: ${report.instances.map((instance) => instance.name).join(', ') || 'none'}`));
  return `${lines.join('\n')}\n`;
}

function renderBar(value: number | null, max: number, unit: string | null): string {
  const width = 24;
  if (value === null || max <= 0) return `[${''.padEnd(width, ' ')}]`;

  const normalizedMax = unit === 'percentage' ? Math.max(max, 1) : max;
  const filled = Math.min(width, Math.max(0, Math.round((value / normalizedMax) * width)));
  return `[${chalk.green('█'.repeat(filled))}${''.padEnd(width - filled, ' ')}]`;
}

function resolveInstances(instances: BranchMetricInstance[], selector: string): BranchMetricInstance[] {
  if (selector === 'all') return instances;
  if (selector === 'primary') return instances.filter((instance) => instance.primary);
  if (selector === 'replicas') return instances.filter((instance) => !instance.primary);

  const ids = selector
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const selected = instances.filter((instance) => ids.includes(instance.id));
  const missing = ids.filter((id) => !instances.some((instance) => instance.id === id));
  if (missing.length > 0) {
    throw new Error(`Invalid instance${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`);
  }
  return selected;
}

function ensureAggregationIncluded(
  aggregations: BranchMetricAggregation[],
  selected: BranchMetricAggregation
): BranchMetricAggregation[] {
  if (aggregations.includes(selected)) return aggregations;
  return [...aggregations, selected];
}

function resolveOutputFormat(flags: Flags, isInteractive: boolean): OutputFormat {
  if (flags.json) return 'json';
  if (flags.watch && flags.output === 'table') return isInteractive ? 'tui' : 'ndjson';
  return flags.output;
}

function parseRefreshInterval(value: string): number {
  const match = value.match(/^(\d+)(ms|s|m)?$/);
  if (!match) throw new Error(`Invalid refresh interval: ${value}`);

  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  if (unit === 'ms') return amount;
  if (unit === 'm') return amount * 60 * 1000;
  return amount * 1000;
}

function formatMetricStatus(
  status: BranchMetricsReport['metrics'][number]['status'],
  requiredConfig: string | null
): string {
  if (status === 'config_required') return `requires ${requiredConfig}`;
  return status;
}

export const BranchMetricsCommand = buildCommand({
  docs: {
    brief: 'Show CPU, memory and disk usage for a branch',
    fullDescription:
      'Reports the metrics of every instance of the branch, the primary and any replicas, as a snapshot or continuously with --watch.',
    customUsage: [
      { input: 'my-branch', brief: 'One-shot snapshot of the default metrics' },
      { input: 'my-branch --watch', brief: 'Continuously refresh metrics in the TUI' },
      {
        input: 'my-branch -w --refresh 5s --instances primary --output ndjson',
        brief: 'Stream NDJSON updates every 5 seconds for the primary instance'
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
      since: {
        kind: 'parsed',
        brief: 'Time range ending now, such as 1h, 24h, or 7d',
        parse: String,
        optional: true
      },
      start: {
        kind: 'parsed',
        brief: 'Start time as an ISO timestamp',
        parse: String,
        optional: true
      },
      end: {
        kind: 'parsed',
        brief: 'End time as an ISO timestamp',
        parse: String,
        optional: true
      },
      metrics: {
        kind: 'parsed',
        brief: 'Metrics to query: default, all, or a comma-separated list',
        parse: String,
        default: 'default'
      },
      instances: {
        kind: 'parsed',
        brief: 'Instances to query: all, primary, replicas, or comma-separated instance IDs',
        parse: String,
        default: 'all'
      },
      aggregations: {
        kind: 'parsed',
        brief: 'Aggregations to query: comma-separated avg,max,min',
        parse: String,
        default: 'avg,max,min'
      },
      aggregation: {
        kind: 'enum',
        values: ['avg', 'max', 'min'],
        brief: 'Aggregation to render in table or TUI output',
        default: 'avg'
      },
      refresh: {
        kind: 'parsed',
        brief: 'Refresh interval for watch mode, such as 10s, 1m, or 500ms',
        parse: String,
        default: '10s'
      },
      output: {
        kind: 'enum',
        values: ['table', 'json', 'ndjson', 'tui'],
        brief: 'Output format',
        default: 'table'
      },
      watch: {
        kind: 'boolean',
        brief: 'Refresh metrics continuously',
        default: false
      },
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      }
    },
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'The branch to show metrics for',
          parse: String,
          placeholder: 'branch',
          optional: true
        }
      ]
    },
    aliases: {
      o: 'output',
      w: 'watch'
    }
  },
  func: implementation
});
