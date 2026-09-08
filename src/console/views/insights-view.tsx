import { Box, Text, useInput } from 'ink';
import type postgres from 'postgres';
import { useEffect, useRef, useState } from 'react';
import type { LocalContext } from '~/context';
import { CLI_NAME } from '~/lib/constants';
import {
  fetchPgStatStatementsReadiness,
  formatCacheHitRate,
  formatInteger,
  formatMilliseconds,
  formatQueryInsightsError,
  getQueryInsightSignals,
  listQueryInsights,
  normalizeQueryForPreview,
  type PgStatStatementsReadiness,
  type QueryInsightRow
} from '~/lib/query-insights';
import { INSIGHTS_SORTS, insightSeverityColor, type InsightsSort, wrapText } from '../insights';
import { clampSelection, cycleNext, listWindow } from '../navigation';

const REFRESH_MS = 15_000;
const FETCH_LIMIT = 100;

type InsightsViewProps = {
  context: LocalContext;
  connectionString: string;
  branchName: string;
  isActive: boolean;
  rows: number;
  columns: number;
};

export function InsightsView({ context, connectionString, branchName, isActive, rows, columns }: InsightsViewProps) {
  const [readiness, setReadiness] = useState<PgStatStatementsReadiness>();
  const [data, setData] = useState<{ total: number; rows: QueryInsightRow[]; capturedAt: number }>();
  const [error, setError] = useState<string>();
  const [paused, setPaused] = useState(false);
  const [sort, setSort] = useState<InsightsSort>('total-time');
  const [selected, setSelected] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOffset, setDetailOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [recheckKey, setRecheckKey] = useState(0);
  const sqlRef = useRef<postgres.Sql | undefined>(undefined);

  useEffect(() => {
    const sql = context.postgres(connectionString);
    sqlRef.current = sql;
    let cancelled = false;

    async function check() {
      try {
        const result = await fetchPgStatStatementsReadiness(sql);
        if (!cancelled) setReadiness(result);
      } catch (checkError) {
        if (!cancelled) setReadiness({ state: 'error', message: formatQueryInsightsError(checkError) });
      }
    }

    void check();

    return () => {
      cancelled = true;
      sqlRef.current = undefined;
      setReadiness(undefined);
      setData(undefined);
      void sql.end();
    };
  }, [context, connectionString, recheckKey]);

  useEffect(() => {
    if (paused || readiness?.state !== 'ready') return;

    let cancelled = false;
    let timer: NodeJS.Timeout | undefined;

    async function tick() {
      const sql = sqlRef.current;
      if (!sql) return;
      try {
        const result = await listQueryInsights(sql, {
          queryTypes: [],
          performance: [],
          databases: [],
          users: [],
          sort,
          direction: 'desc',
          limit: FETCH_LIMIT,
          offset: 0
        });
        if (!cancelled) {
          setData({ total: result.total, rows: result.rows, capturedAt: Date.now() });
          setError(undefined);
        }
      } catch (fetchError) {
        if (!cancelled) setError(formatQueryInsightsError(fetchError));
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
  }, [readiness, sort, paused, refreshKey]);

  const insightRows = data?.rows ?? [];
  const selectedIndex = clampSelection(selected, insightRows.length);
  const selectedRow = insightRows[selectedIndex];

  useInput(
    (input, key) => {
      if (detailOpen) {
        if (key.escape || key.return) {
          setDetailOpen(false);
          setDetailOffset(0);
          return;
        }
        if (key.upArrow || input === 'k') {
          setDetailOffset((value) => Math.max(0, value - 1));
          return;
        }
        if (key.downArrow || input === 'j') {
          setDetailOffset((value) => value + 1);
        }
        return;
      }

      if (readiness && readiness.state !== 'ready') {
        if (input === 'r') {
          setRecheckKey((value) => value + 1);
        }
        return;
      }

      if (input === ' ') {
        setPaused((value) => !value);
        return;
      }
      if (input === 's') {
        setSort((current) => cycleNext(INSIGHTS_SORTS, current));
        setSelected(0);
        return;
      }
      if (input === 'r') {
        setRefreshKey((value) => value + 1);
        return;
      }
      if (key.upArrow || input === 'k') {
        setSelected(clampSelection(selectedIndex - 1, insightRows.length));
        return;
      }
      if (key.downArrow || input === 'j') {
        setSelected(clampSelection(selectedIndex + 1, insightRows.length));
        return;
      }
      if (input === 'g') {
        setSelected(0);
        return;
      }
      if (input === 'G') {
        setSelected(Math.max(0, insightRows.length - 1));
        return;
      }
      if (key.return && selectedRow) {
        setDetailOpen(true);
        setDetailOffset(0);
      }
    },
    { isActive }
  );

  if (!readiness) {
    return (
      <Box borderStyle="round" borderColor="gray" paddingX={1} flexGrow={1}>
        <Text color="yellow">Checking pg_stat_statements on {branchName}…</Text>
      </Box>
    );
  }

  if (readiness.state !== 'ready') {
    return (
      <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column" flexGrow={1}>
        {readiness.state === 'unavailable' ? (
          <Text color="red">pg_stat_statements is not available for this branch image/region.</Text>
        ) : readiness.state === 'disabled' ? (
          <>
            <Text color="yellow">Query insights require pg_stat_statements to be enabled on this branch.</Text>
            <Text color="gray">
              Run `{CLI_NAME} branch query-insights enable {branchName}` and press r to re-check.
            </Text>
          </>
        ) : (
          <Text color="red">{readiness.message}</Text>
        )}
      </Box>
    );
  }

  if (detailOpen && selectedRow) {
    return <InsightDetail row={selectedRow} offset={detailOffset} rows={rows} columns={columns} />;
  }

  const visibleCount = Math.max(4, rows - 14);
  const top = listWindow(selectedIndex, insightRows.length, visibleCount);
  const visibleRows = insightRows.slice(top, top + visibleCount);

  return (
    <Box borderStyle="round" borderColor="blue" paddingX={1} flexDirection="column" flexGrow={1}>
      <Box>
        <Text bold color="blue">
          insights
        </Text>
        <Text color="gray">
          {'  '}
          sort: {sort}
          {paused ? ' · paused' : ''}
          {data
            ? ` · ${formatInteger(data.total)} queries · updated ${new Date(data.capturedAt).toLocaleTimeString()}`
            : ''}
        </Text>
      </Box>
      {error ? <Text color="red">{error}</Text> : null}
      {!data && !error ? <Text color="yellow">Loading query insights…</Text> : null}
      {data && insightRows.length === 0 ? (
        <Text color="gray">No query statistics recorded yet. Run some queries against the branch first.</Text>
      ) : null}
      {insightRows.length > 0 ? (
        <>
          <Box marginTop={1}>
            <Box width={2} flexShrink={0} />
            <Box width={2} flexShrink={0}>
              <Text bold>!</Text>
            </Box>
            <Box width={22} flexShrink={0}>
              <Text bold>query id</Text>
            </Box>
            <Box width={9} flexShrink={0}>
              <Text bold>calls</Text>
            </Box>
            <Box width={9} flexShrink={0}>
              <Text bold>total</Text>
            </Box>
            <Box width={9} flexShrink={0}>
              <Text bold>mean</Text>
            </Box>
            <Box width={9} flexShrink={0}>
              <Text bold>rows</Text>
            </Box>
            <Box width={8} flexShrink={0}>
              <Text bold>cache</Text>
            </Box>
            <Box width={18} flexShrink={0}>
              <Text bold>db/user</Text>
            </Box>
            <Text bold>query</Text>
          </Box>
          {top > 0 ? <Text color="gray"> … {top} more above</Text> : null}
          {visibleRows.map((row, index) => {
            const rowIndex = top + index;
            const isSelected = rowIndex === selectedIndex;
            const severity = insightSeverityColor(row);
            return (
              <Box key={`${row.queryid}:${row.database}:${row.user}`}>
                <Box width={2} flexShrink={0}>
                  <Text color="cyan">{isSelected ? '›' : ' '}</Text>
                </Box>
                <Box width={2} flexShrink={0}>
                  <Text color={severity}>{severity ? '!' : ' '}</Text>
                </Box>
                <Box width={22} flexShrink={0}>
                  <Text color={isSelected ? 'cyan' : undefined} wrap="truncate-end">
                    {row.queryid}
                  </Text>
                </Box>
                <Box width={9} flexShrink={0}>
                  <Text>{formatInteger(row.calls)}</Text>
                </Box>
                <Box width={9} flexShrink={0}>
                  <Text>{formatMilliseconds(row.total_exec_time)}</Text>
                </Box>
                <Box width={9} flexShrink={0}>
                  <Text color={row.mean_exec_time >= 1000 ? 'red' : row.mean_exec_time >= 100 ? 'yellow' : undefined}>
                    {formatMilliseconds(row.mean_exec_time)}
                  </Text>
                </Box>
                <Box width={9} flexShrink={0}>
                  <Text>{formatInteger(row.rows)}</Text>
                </Box>
                <Box width={8} flexShrink={0}>
                  <Text>{formatCacheHitRate(row.cache_hit_rate)}</Text>
                </Box>
                <Box width={18} flexShrink={0}>
                  <Text color="gray" wrap="truncate-end">
                    {row.database}/{row.user}
                  </Text>
                </Box>
                <Text color={isSelected ? undefined : 'gray'} wrap="truncate-end">
                  {normalizeQueryForPreview(row.query)}
                </Text>
              </Box>
            );
          })}
          {top + visibleCount < insightRows.length ? (
            <Text color="gray"> … {insightRows.length - top - visibleCount} more below</Text>
          ) : null}
        </>
      ) : null}
    </Box>
  );
}

function InsightDetail({
  row,
  offset,
  rows,
  columns
}: {
  row: QueryInsightRow;
  offset: number;
  rows: number;
  columns: number;
}) {
  const signals = getQueryInsightSignals(row);
  const wrapWidth = Math.max(20, columns - 6);
  const queryLines = wrapText(row.query, wrapWidth);
  const visibleCount = Math.max(4, rows - 21 - (signals.length > 0 ? signals.length + 2 : 0));
  const maxOffset = Math.max(0, queryLines.length - visibleCount);
  const clampedOffset = Math.min(offset, maxOffset);
  const visibleLines = queryLines.slice(clampedOffset, clampedOffset + visibleCount);

  return (
    <Box borderStyle="round" borderColor="blue" paddingX={1} flexDirection="column" flexGrow={1}>
      <Text bold color="blue">
        query {row.queryid} · {row.database}/{row.user}
      </Text>
      <Box marginTop={1}>
        <Box width={28}>
          <Text color="gray">calls</Text>
        </Box>
        <Text>{formatInteger(row.calls)}</Text>
      </Box>
      <Box>
        <Box width={28}>
          <Text color="gray">total / mean time</Text>
        </Box>
        <Text>
          {formatMilliseconds(row.total_exec_time)} / {formatMilliseconds(row.mean_exec_time)}
        </Text>
      </Box>
      <Box>
        <Box width={28}>
          <Text color="gray">min / max / stddev</Text>
        </Box>
        <Text>
          {formatMilliseconds(row.min_exec_time)} / {formatMilliseconds(row.max_exec_time)} /{' '}
          {formatMilliseconds(row.stddev_exec_time)}
        </Text>
      </Box>
      <Box>
        <Box width={28}>
          <Text color="gray">rows / cache hit</Text>
        </Box>
        <Text>
          {formatInteger(row.rows)} / {formatCacheHitRate(row.cache_hit_rate)}
        </Text>
      </Box>
      <Box>
        <Box width={28}>
          <Text color="gray">temp blocks read / written</Text>
        </Box>
        <Text>
          {formatInteger(row.temp_blks_read)} / {formatInteger(row.temp_blks_written)}
        </Text>
      </Box>
      {signals.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>potential issues</Text>
          {signals.map((signal) => (
            <Text key={signal.label} color={signal.level === 'critical' ? 'red' : 'yellow'}>
              {signal.label}: {signal.reason}
            </Text>
          ))}
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text bold>query</Text>
        {clampedOffset > 0 ? <Text color="gray"> · {clampedOffset} lines above</Text> : null}
      </Box>
      {visibleLines.map((line, index) => (
        <Text key={`${clampedOffset + index}`}>{line}</Text>
      ))}
      {maxOffset > clampedOffset ? (
        <Text color="gray"> … {maxOffset - clampedOffset} more lines · j/k scroll</Text>
      ) : null}
      <Box marginTop={1}>
        <Text color="gray">esc back to list</Text>
      </Box>
    </Box>
  );
}
