import { describe, expect, test } from 'bun:test';
import type { BranchMetricsReport } from '@xata.io/utils';
import { buildMetricRows } from './metrics';

function makeReport(metrics: BranchMetricsReport['metrics']): BranchMetricsReport {
  return {
    schemaVersion: 1,
    capturedAt: '2026-07-11T00:00:00.000Z',
    target: { organizationId: 'org-1', projectId: 'project-1', branchId: 'branch-1', branchName: 'main' },
    timeRange: { start: '2026-07-10T23:00:00.000Z', end: '2026-07-11T00:00:00.000Z' },
    instances: [{ id: 'inst-1', name: 'Primary', primary: true }],
    metrics
  };
}

describe('buildMetricRows', () => {
  test('builds data rows for the selected aggregation only', () => {
    const report = makeReport([
      {
        key: 'cpu',
        title: 'CPU usage',
        description: '',
        unit: 'percentage',
        status: 'ok',
        requiredConfig: null,
        series: [
          {
            instanceId: 'inst-1',
            instanceName: 'Primary',
            primary: true,
            aggregation: 'avg',
            latest: { timestamp: '2026-07-11T00:00:00.000Z', value: 0.5 },
            stats: { min: 0.1, max: 2, avg: 0.5 },
            points: [{ timestamp: '2026-07-11T00:00:00.000Z', value: 0.5 }]
          },
          {
            instanceId: 'inst-1',
            instanceName: 'Primary',
            primary: true,
            aggregation: 'max',
            latest: { timestamp: '2026-07-11T00:00:00.000Z', value: 2 },
            stats: { min: 0.1, max: 2, avg: 0.8 },
            points: [{ timestamp: '2026-07-11T00:00:00.000Z', value: 2 }]
          }
        ]
      }
    ]);

    const rows = buildMetricRows(report, 'avg');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      kind: 'data',
      key: 'cpu',
      title: 'CPU usage',
      instanceName: 'Primary',
      latest: '50.0%',
      min: '10.0%',
      max: '200.0%',
      avg: '50.0%',
      ratio: 0.25
    });
  });

  test('clamps ratio to [0, 1]', () => {
    const report = makeReport([
      {
        key: 'iops_read',
        title: 'Read IOPS',
        description: '',
        unit: 'iops',
        status: 'ok',
        requiredConfig: null,
        series: [
          {
            instanceId: 'inst-1',
            instanceName: 'Primary',
            primary: true,
            aggregation: 'avg',
            latest: { timestamp: '2026-07-11T00:00:00.000Z', value: 10 },
            stats: { min: 1, max: 5, avg: 3 },
            points: [{ timestamp: '2026-07-11T00:00:00.000Z', value: 10 }]
          }
        ]
      }
    ]);

    const rows = buildMetricRows(report, 'avg');

    expect(rows[0]?.kind).toBe('data');
    expect(rows[0]?.kind === 'data' && rows[0].ratio).toBe(1);
  });

  test('disambiguates metrics that share a title', () => {
    const series = {
      instanceId: 'inst-1',
      instanceName: 'Primary',
      primary: true,
      aggregation: 'avg' as const,
      latest: { timestamp: '2026-07-11T00:00:00.000Z', value: 1 },
      stats: { min: 1, max: 1, avg: 1 },
      points: [{ timestamp: '2026-07-11T00:00:00.000Z', value: 1 }]
    };
    const report = makeReport([
      {
        key: 'connections_active',
        title: 'Connection count',
        description: '',
        unit: null,
        status: 'ok',
        requiredConfig: null,
        series: [series]
      },
      {
        key: 'connections_idle',
        title: 'Connection count',
        description: '',
        unit: null,
        status: 'ok',
        requiredConfig: null,
        series: [series]
      }
    ]);

    const rows = buildMetricRows(report, 'avg');

    expect(rows.map((row) => row.title)).toEqual(['Connection count (active)', 'Connection count (idle)']);
  });

  test('emits status rows for missing data and required config', () => {
    const report = makeReport([
      {
        key: 'memory',
        title: 'Memory usage',
        description: '',
        unit: 'bytes',
        status: 'no_data',
        requiredConfig: null,
        series: []
      },
      {
        key: 'latency_read',
        title: 'Read latency',
        description: '',
        unit: 'ms',
        status: 'config_required',
        requiredConfig: 'track_io_timing',
        series: []
      }
    ]);

    const rows = buildMetricRows(report, 'avg');

    expect(rows).toEqual([
      { kind: 'status', key: 'memory', title: 'Memory usage', status: 'no data' },
      { kind: 'status', key: 'latency_read', title: 'Read latency', status: 'requires track_io_timing' }
    ]);
  });
});
