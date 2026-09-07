import type { Types } from '@xata.io/api';
import { BRANCH_LOG_MAX_LIMIT, branchLogFingerprint, sortBranchLogsChronologically } from '@xata.io/utils';
import type { LocalContext } from '~/context';

export const BRANCH_LOG_FOLLOW_INTERVAL_MS = 2_000;
const FOLLOW_OVERLAP_MS = 5_000;

export type BranchLogTimeRange = {
  start: string;
  end: string;
};

export type BranchLogFetchOptions = {
  organizationId: string;
  projectId: string;
  branchId: string;
  timeRange: BranchLogTimeRange;
  filters: Types.LogFilter[];
  limit: number;
};

export async function fetchBranchLogs(context: LocalContext, options: BranchLogFetchOptions) {
  const logs: Types.LogEntry[] = [];
  let cursor: string | null | undefined;

  do {
    const remaining = options.limit - logs.length;
    const response = await context.api.branches.branchLogs({
      pathParams: {
        organizationID: options.organizationId,
        projectID: options.projectId,
        branchID: options.branchId
      },
      body: {
        start: options.timeRange.start,
        end: options.timeRange.end,
        limit: Math.min(remaining, BRANCH_LOG_MAX_LIMIT),
        ...(options.filters.length > 0 && { filters: options.filters }),
        ...(cursor && { cursor })
      }
    });

    logs.push(...response.logs.slice(0, remaining));
    cursor = response.nextCursor;
  } while (cursor && logs.length < options.limit);

  return sortBranchLogsChronologically(logs);
}

export function normalizeBranchLogsError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (/404|not found|not available|disabled/i.test(message)) {
    throw new Error('Branch logs are not available for this branch.');
  }
  throw error;
}

export type BranchLogFollowState = {
  seen: Map<string, number>;
  nextStart: string;
  initialEnd: string;
  firstPoll: boolean;
};

export function createBranchLogFollowState(timeRange: BranchLogTimeRange): BranchLogFollowState {
  return { seen: new Map(), nextStart: timeRange.start, initialEnd: timeRange.end, firstPoll: true };
}

export function nextBranchLogPollRange(state: BranchLogFollowState, now = new Date()): BranchLogTimeRange {
  return { start: state.nextStart, end: state.firstPoll ? state.initialEnd : now.toISOString() };
}

export function ingestBranchLogs(state: BranchLogFollowState, logs: Types.LogEntry[]): Types.LogEntry[] {
  let newestTimestamp = new Date(state.nextStart).getTime();

  const unseen = logs.filter((log) => {
    const logTimestamp = new Date(log.timestamp).getTime();
    newestTimestamp = Math.max(newestTimestamp, logTimestamp);
    const fingerprint = branchLogFingerprint(log);
    if (state.seen.has(fingerprint)) return false;
    state.seen.set(fingerprint, logTimestamp);
    return true;
  });

  const nextStartTimestamp = Math.max(0, newestTimestamp - FOLLOW_OVERLAP_MS);
  pruneSeenLogs(state.seen, nextStartTimestamp);
  state.nextStart = new Date(nextStartTimestamp).toISOString();
  state.firstPoll = false;

  return unseen;
}

export function pruneSeenLogs(seen: Map<string, number>, minTimestamp: number) {
  for (const [fingerprint, timestamp] of seen) {
    if (timestamp < minTimestamp) {
      seen.delete(fingerprint);
    }
  }
}
