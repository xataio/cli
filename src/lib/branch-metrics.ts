import type { Types } from '@xata.io/api';
import {
  buildBranchMetricsReport,
  computeBranchInstanceName,
  getBranchMetricConfig,
  isBranchMetricKey,
  resolveBranchMetricTimeRange,
  type BranchMetricAggregation,
  type BranchMetricInstance,
  type BranchMetricKey,
  type BranchMetricRequiredConfig,
  type BranchMetricResult,
  type BranchMetricsReport
} from '@xata.io/utils';
import type { LocalContext } from '~/context';

export type BranchMetricsTarget = {
  organizationId: string;
  projectId: string;
  branchId: string;
  branchName: string;
  instances: BranchMetricInstance[];
};

export type BranchMetricsFetchOptions = {
  target: BranchMetricsTarget;
  metricKeys: BranchMetricKey[];
  aggregations: BranchMetricAggregation[];
  instanceSelector: string;
  since?: string;
  start?: string;
  end?: string;
};

export function resolveMetricInstances(instances: BranchMetricInstance[], selector: string): BranchMetricInstance[] {
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

export async function getDisabledMetricConfigs(
  context: LocalContext,
  target: Pick<BranchMetricsTarget, 'organizationId' | 'projectId' | 'branchId'>
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

export async function fetchBranchMetricsReport(
  context: LocalContext,
  options: BranchMetricsFetchOptions
): Promise<BranchMetricsReport> {
  const { target, metricKeys, aggregations, instanceSelector, since, start, end } = options;
  const timeRange = resolveBranchMetricTimeRange({ since, start, end });
  const selectedInstances = resolveMetricInstances(target.instances, instanceSelector);
  const disabledConfigs = await getDisabledMetricConfigs(context, target);
  const metricResults: Partial<Record<BranchMetricKey, BranchMetricResult>> = {};

  if (selectedInstances.length > 0) {
    const enabledMetricKeys = metricKeys.filter((metric) => {
      const config = getBranchMetricConfig(metric);
      return !config.requiresConfig || !disabledConfigs.has(config.requiresConfig);
    });

    if (enabledMetricKeys.length > 0) {
      const response = await context.api.branches.branchMetrics({
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
