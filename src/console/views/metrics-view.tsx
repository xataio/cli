import type { BranchMetricAggregation, BranchMetricInstance, BranchMetricsReport } from '@xata.io/utils';
import { BRANCH_METRIC_AGGREGATIONS, DEFAULT_BRANCH_METRIC_KEYS } from '@xata.io/utils';
import { Box, Text, useInput } from 'ink';
import { useEffect, useState } from 'react';
import type { LocalContext } from '~/context';
import { fetchBranchMetricsReport } from '~/lib/branch-metrics';
import { getErrorMessage } from '~/lib/cli-utils';
import { buildMetricRows, METRIC_SINCE_OPTIONS, type MetricSince } from '../metrics';
import { cycleNext } from '../navigation';

const REFRESH_MS = 15_000;
const BAR_WIDTH = 16;

type MetricsViewProps = {
  context: LocalContext;
  organizationId: string;
  projectId: string;
  branchId: string;
  branchName: string;
  instances: BranchMetricInstance[];
  isActive: boolean;
  rows: number;
};

export function MetricsView({
  context,
  organizationId,
  projectId,
  branchId,
  branchName,
  instances,
  isActive,
  rows
}: MetricsViewProps) {
  const [report, setReport] = useState<BranchMetricsReport>();
  const [error, setError] = useState<string>();
  const [paused, setPaused] = useState(false);
  const [aggregation, setAggregation] = useState<BranchMetricAggregation>('avg');
  const [since, setSince] = useState<MetricSince>('1h');
  const [offset, setOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (paused) return;

    let cancelled = false;
    let timer: NodeJS.Timeout | undefined;

    async function tick() {
      try {
        const nextReport = await fetchBranchMetricsReport(context, {
          target: { organizationId, projectId, branchId, branchName, instances },
          metricKeys: [...DEFAULT_BRANCH_METRIC_KEYS],
          aggregations: [...BRANCH_METRIC_AGGREGATIONS],
          instanceSelector: 'all',
          since
        });
        if (!cancelled) {
          setReport(nextReport);
          setError(undefined);
        }
      } catch (fetchError) {
        if (!cancelled) setError(getErrorMessage(fetchError));
      }
      if (!cancelled) {
        timer = setTimeout(() => void tick(), REFRESH_MS);
      }
    }

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [context, organizationId, projectId, branchId, branchName, instances, since, paused, refreshKey]);

  const allRows = report ? buildMetricRows(report, aggregation) : [];
  const visibleCount = Math.max(4, rows - 14);
  const maxOffset = Math.max(0, allRows.length - visibleCount);
  const clampedOffset = Math.min(offset, maxOffset);
  const visibleRows = allRows.slice(clampedOffset, clampedOffset + visibleCount);

  useInput(
    (input, key) => {
      if (input === ' ') {
        setPaused((value) => !value);
        return;
      }
      if (input === 'a') {
        setAggregation((current) => cycleNext(BRANCH_METRIC_AGGREGATIONS, current));
        return;
      }
      if (input === 's') {
        setSince((current) => cycleNext(METRIC_SINCE_OPTIONS, current));
        setOffset(0);
        return;
      }
      if (input === 'r') {
        setRefreshKey((value) => value + 1);
        return;
      }
      if (key.upArrow || input === 'k') {
        setOffset(Math.max(0, clampedOffset - 1));
        return;
      }
      if (key.downArrow || input === 'j') {
        setOffset(Math.min(maxOffset, clampedOffset + 1));
        return;
      }
      if (input === 'g') {
        setOffset(0);
        return;
      }
      if (input === 'G') {
        setOffset(maxOffset);
      }
    },
    { isActive }
  );

  if (!report && !error) {
    return (
      <Box borderStyle="round" borderColor="gray" paddingX={1} flexGrow={1}>
        <Text color="yellow">Loading metrics…</Text>
      </Box>
    );
  }

  return (
    <Box borderStyle="round" borderColor="magenta" paddingX={1} flexDirection="column" flexGrow={1}>
      <Box>
        <Text bold color="magenta">
          metrics
        </Text>
        <Text color="gray">
          {'  '}
          {aggregation} · last {since}
          {paused ? ' · paused' : ''}
          {report ? ` · updated ${new Date(report.capturedAt).toLocaleTimeString()}` : ''}
        </Text>
      </Box>
      {error ? <Text color="red">{error}</Text> : null}
      {report ? (
        <>
          <Box marginTop={1}>
            <Box width={26}>
              <Text bold>metric</Text>
            </Box>
            <Box width={12}>
              <Text bold>instance</Text>
            </Box>
            <Box width={BAR_WIDTH + 2} />
            <Box width={11}>
              <Text bold>latest</Text>
            </Box>
            <Box width={11}>
              <Text bold>min</Text>
            </Box>
            <Box width={11}>
              <Text bold>max</Text>
            </Box>
            <Text bold>avg</Text>
          </Box>
          {clampedOffset > 0 ? <Text color="gray"> … {clampedOffset} more above</Text> : null}
          {visibleRows.map((row, rowIndex) =>
            row.kind === 'status' ? (
              <Box key={`${row.key}:${rowIndex}`}>
                <Box width={26}>
                  <Text wrap="truncate-end">{row.title}</Text>
                </Box>
                <Text color="gray">{row.status}</Text>
              </Box>
            ) : (
              <Box key={`${row.key}:${row.instanceName}`}>
                <Box width={26}>
                  <Text wrap="truncate-end">{row.title}</Text>
                </Box>
                <Box width={12}>
                  <Text color="gray" wrap="truncate-end">
                    {row.instanceName}
                  </Text>
                </Box>
                <Box width={BAR_WIDTH + 2}>
                  <Text color="green">{renderBar(row.ratio)}</Text>
                </Box>
                <Box width={11}>
                  <Text>{row.latest}</Text>
                </Box>
                <Box width={11}>
                  <Text color="gray">{row.min}</Text>
                </Box>
                <Box width={11}>
                  <Text color="gray">{row.max}</Text>
                </Box>
                <Text color="gray">{row.avg}</Text>
              </Box>
            )
          )}
          {maxOffset > clampedOffset ? (
            <Text color="gray"> … {allRows.length - clampedOffset - visibleCount} more below</Text>
          ) : null}
          <Box marginTop={1}>
            <Text color="gray">
              instances: {report.instances.map((instance) => instance.name).join(', ') || 'none'}
            </Text>
          </Box>
        </>
      ) : null}
    </Box>
  );
}

function renderBar(ratio: number): string {
  const filled = Math.min(BAR_WIDTH, Math.max(0, Math.round(ratio * BAR_WIDTH)));
  return `${'█'.repeat(filled)}${' '.repeat(BAR_WIDTH - filled)}`;
}
