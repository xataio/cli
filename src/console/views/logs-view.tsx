import type { Types } from '@xata.io/api';
import { buildBranchLogFilters } from '@xata.io/utils';
import { Box, Text, useInput } from 'ink';
import { useEffect, useRef, useState } from 'react';
import type { LocalContext } from '~/context';
import {
  BRANCH_LOG_FOLLOW_INTERVAL_MS,
  createBranchLogFollowState,
  fetchBranchLogs,
  ingestBranchLogs,
  nextBranchLogPollRange,
  type BranchLogFollowState
} from '~/lib/branch-logs';
import { getErrorMessage } from '~/lib/cli-utils';
import {
  appendLogs,
  formatLogTimestamp,
  LOG_LEVEL_FILTERS,
  logLevelColor,
  logLevelsForFilter,
  type LogLevelFilter
} from '../logs';
import { cycleNext } from '../navigation';

const INITIAL_WINDOW_MS = 15 * 60_000;
const FETCH_LIMIT = 200;

type LogsViewProps = {
  context: LocalContext;
  organizationId: string;
  projectId: string;
  branchId: string;
  isActive: boolean;
  rows: number;
};

export function LogsView({ context, organizationId, projectId, branchId, isActive, rows }: LogsViewProps) {
  const [logs, setLogs] = useState<Types.LogEntry[]>([]);
  const [error, setError] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [level, setLevel] = useState<LogLevelFilter>('all');
  const [offset, setOffset] = useState<number>();
  const follower = useRef<{ level: LogLevelFilter; state: BranchLogFollowState } | undefined>(undefined);

  useEffect(() => {
    setLogs([]);
    setLoaded(false);
    setOffset(undefined);
  }, [level]);

  useEffect(() => {
    if (paused) return;

    let cancelled = false;
    let timer: NodeJS.Timeout | undefined;
    if (!follower.current || follower.current.level !== level) {
      const now = new Date();
      follower.current = {
        level,
        state: createBranchLogFollowState({
          start: new Date(now.getTime() - INITIAL_WINDOW_MS).toISOString(),
          end: now.toISOString()
        })
      };
    }
    const followState = follower.current.state;
    const filters = buildBranchLogFilters({
      levels: logLevelsForFilter(level),
      instances: [],
      processes: []
    });

    async function tick() {
      try {
        const fetched = await fetchBranchLogs(context, {
          organizationId,
          projectId,
          branchId,
          timeRange: nextBranchLogPollRange(followState),
          filters,
          limit: FETCH_LIMIT
        });
        if (!cancelled) {
          const unseen = ingestBranchLogs(followState, fetched);
          if (unseen.length > 0) setLogs((buffer) => appendLogs(buffer, unseen));
          setLoaded(true);
          setError(undefined);
        }
      } catch (fetchError) {
        if (!cancelled) setError(getErrorMessage(fetchError));
      }
      if (!cancelled) {
        timer = setTimeout(() => void tick(), BRANCH_LOG_FOLLOW_INTERVAL_MS);
      }
    }

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [context, organizationId, projectId, branchId, level, paused]);

  const visibleCount = Math.max(4, rows - 11);
  const maxOffset = Math.max(0, logs.length - visibleCount);
  const following = offset === undefined;
  const clampedOffset = following ? maxOffset : Math.min(offset, maxOffset);
  const visibleLogs = logs.slice(clampedOffset, clampedOffset + visibleCount);

  useInput(
    (input, key) => {
      if (input === ' ') {
        setPaused((value) => !value);
        return;
      }
      if (input === 'l') {
        setLevel((current) => cycleNext(LOG_LEVEL_FILTERS, current));
        return;
      }
      if (key.upArrow || input === 'k') {
        setOffset(Math.max(0, clampedOffset - 1));
        return;
      }
      if (key.downArrow || input === 'j') {
        const next = clampedOffset + 1;
        setOffset(next >= maxOffset ? undefined : next);
        return;
      }
      if (input === 'g') {
        setOffset(0);
        return;
      }
      if (input === 'G') {
        setOffset(undefined);
      }
    },
    { isActive }
  );

  return (
    <Box borderStyle="round" borderColor="yellow" paddingX={1} flexDirection="column" flexGrow={1}>
      <Box>
        <Text bold color="yellow">
          logs
        </Text>
        <Text color="gray">
          {'  '}
          level: {level}
          {paused ? ' · paused' : following ? ' · following' : ' · scrolled'}
          {logs.length > 0 ? ` · ${logs.length} buffered` : ''}
        </Text>
      </Box>
      {error ? <Text color="red">{error}</Text> : null}
      {!loaded && !error ? <Text color="yellow">Loading logs…</Text> : null}
      {loaded && logs.length === 0 ? (
        <Text color="gray">No logs in the last 15 minutes{level === 'all' ? '' : ` at level ${level}`}.</Text>
      ) : null}
      {clampedOffset > 0 ? <Text color="gray"> … {clampedOffset} more above</Text> : null}
      {visibleLogs.map((log, index) => (
        <Box key={`${log.timestamp}:${clampedOffset + index}`}>
          <Box width={9} flexShrink={0}>
            <Text color="gray">{formatLogTimestamp(log.timestamp)}</Text>
          </Box>
          <Box width={8} flexShrink={0}>
            <Text color={logLevelColor(log.level)}>{log.level ?? '-'}</Text>
          </Box>
          <Box width={16} flexShrink={0}>
            <Text color="cyan" wrap="truncate-end">
              {log.process ?? '-'}
            </Text>
          </Box>
          <Text wrap="truncate-end">{log.message}</Text>
        </Box>
      ))}
      {maxOffset > clampedOffset ? (
        <Text color="gray"> … {maxOffset - clampedOffset} more below · G to follow</Text>
      ) : null}
    </Box>
  );
}
