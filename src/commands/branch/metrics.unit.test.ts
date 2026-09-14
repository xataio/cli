import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { implementation, resolveOutputFormat } from './metrics';

const baseFlags = {
  organization: 'org',
  project: 'project',
  branch: 'branch',
  start: '2026-05-23T09:00:00.000Z',
  end: '2026-05-23T10:00:00.000Z',
  metrics: 'cpu',
  instances: 'all',
  aggregations: 'avg',
  aggregation: 'avg' as const,
  refresh: '10s',
  output: 'json' as const,
  watch: false
};

function buildContext() {
  const stdout: string[] = [];
  const branchMetrics = mock(async () => ({
    start: baseFlags.start,
    end: baseFlags.end,
    results: [
      {
        metric: 'cpu',
        unit: 'percentage',
        series: [
          {
            instanceID: 'instance-primary',
            aggregation: 'avg',
            values: [
              { timestamp: '2026-05-23T09:59:00.000Z', value: 0.25 },
              { timestamp: '2026-05-23T10:00:00.000Z', value: 0.5 }
            ]
          }
        ]
      }
    ]
  }));

  const context = {
    api: {
      branches: {
        describeBranch: mock(async () => ({
          id: 'branch',
          name: 'main',
          status: {
            instances: [{ id: 'instance-primary', primary: true }]
          }
        })),
        getBranchPostgresConfig: mock(async () => ({
          parameters: [
            { name: 'track_io_timing', currentValue: 'on' },
            { name: 'track_wal_io_timing', currentValue: 'on' }
          ]
        })),
        branchMetrics
      }
    },
    process: {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: () => {} },
      exit: () => {}
    },
    isInteractive: false,
    getOrganization: mock(async () => 'org'),
    getProject: mock(async () => 'project'),
    getBranch: mock(async () => 'branch')
  } as unknown as LocalContext;

  return { context, stdout, branchMetrics };
}

describe('branch metrics command', () => {
  test('prints an AI-friendly JSON metrics report', async () => {
    const { context, stdout, branchMetrics } = buildContext();

    await implementation.call(context, baseFlags);

    expect(branchMetrics).toHaveBeenCalledTimes(1);
    const output = JSON.parse(stdout.join(''));
    expect(output.schemaVersion).toBe(1);
    expect(output.target).toMatchObject({
      organizationId: 'org',
      projectId: 'project',
      branchId: 'branch',
      branchName: 'main'
    });
    expect(output.instances).toEqual([{ id: 'instance-primary', name: 'Primary', primary: true }]);
    expect(output.metrics[0]).toMatchObject({
      key: 'cpu',
      unit: 'percentage',
      status: 'ok',
      series: [
        {
          instanceId: 'instance-primary',
          instanceName: 'Primary',
          latest: { timestamp: '2026-05-23T10:00:00.000Z', value: 0.5 },
          stats: { min: 0.25, max: 0.5, avg: 0.375 }
        }
      ]
    });
  });

  test('prints branch metrics as a compact borderless table', async () => {
    const { context, stdout, branchMetrics } = buildContext();

    await implementation.call(context, { ...baseFlags, output: 'table' });

    expect(branchMetrics).toHaveBeenCalledTimes(1);
    const output = stdout.join('');
    expect(output).toContain('Metrics for main (branch)');
    expect(output).toContain('Metric');
    expect(output).toContain('Primary');
  });

  test('keeps an explicit --output table under an agent, where the JSON default would win', async () => {
    const { context, stdout } = buildContext();

    await implementation.call({ ...context, isAgent: true } as LocalContext, { ...baseFlags, output: 'table' });

    const output = stdout.join('');
    expect(output).toContain('Metrics for main (branch)');
    expect(() => JSON.parse(output)).toThrow();
  });

  test('falls back to JSON under an agent when no --output was chosen', async () => {
    const { context, stdout } = buildContext();

    await implementation.call({ ...context, isAgent: true } as LocalContext, { ...baseFlags, output: undefined });

    expect(JSON.parse(stdout.join('')).schemaVersion).toBe(1);
  });

  test('still prints the human table when nothing is chosen and no agent is detected', async () => {
    const { context, stdout } = buildContext();

    await implementation.call(context, { ...baseFlags, output: undefined });

    expect(stdout.join('')).toContain('Metrics for main (branch)');
  });

  test('shows the expected timestamp format for invalid start and end times', async () => {
    const { context: startContext } = buildContext();
    await expect(implementation.call(startContext, { ...baseFlags, start: '10' })).rejects.toThrow(
      'Invalid --start time: 10. Use format YYYY-MM-DDTHH:mm:ss.sssZ, for example 2026-05-23T10:00:00.000Z.'
    );

    const { context: endContext } = buildContext();
    await expect(implementation.call(endContext, { ...baseFlags, end: 'tomorrow' })).rejects.toThrow(
      'Invalid --end time: tomorrow. Use format YYYY-MM-DDTHH:mm:ss.sssZ, for example 2026-05-23T10:00:00.000Z.'
    );
  });
});

describe('resolveOutputFormat', () => {
  const asContext = (json: boolean | undefined, isAgent: boolean, isInteractive = false) =>
    ({ json, isAgent, isInteractive }) as unknown as LocalContext;

  test('gives an agent watching metrics the streaming shape, not one JSON document per refresh', () => {
    const format = resolveOutputFormat({ ...baseFlags, output: undefined, watch: true }, asContext(undefined, true));

    expect(format).toBe('ndjson');
  });

  test('keeps the TUI for an interactive human watching', () => {
    const format = resolveOutputFormat(
      { ...baseFlags, output: undefined, watch: true },
      asContext(undefined, false, true)
    );

    expect(format).toBe('tui');
  });

  test('leaves an explicit --output alone, including the value that is also the default', () => {
    expect(resolveOutputFormat({ ...baseFlags, output: 'table', watch: false }, asContext(undefined, true))).toBe(
      'table'
    );
  });

  test('gives an agent JSON when it chose no format and is not watching', () => {
    expect(resolveOutputFormat({ ...baseFlags, output: undefined, watch: false }, asContext(undefined, true))).toBe(
      'json'
    );
  });
});
