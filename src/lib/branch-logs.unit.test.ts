import { describe, expect, test } from 'bun:test';
import type { Types } from '@xata.io/api';
import {
  createBranchLogFollowState,
  ingestBranchLogs,
  nextBranchLogPollRange,
  normalizeBranchLogsError,
  pruneSeenLogs
} from './branch-logs';

function makeLog(timestamp: string, message: string): Types.LogEntry {
  return { timestamp, level: 'info', instanceID: 'inst-1', process: 'postgres', message } as Types.LogEntry;
}

describe('branch log follow state', () => {
  test('first poll uses the initial range, later polls end at now', () => {
    const state = createBranchLogFollowState({
      start: '2026-07-11T10:00:00.000Z',
      end: '2026-07-11T10:15:00.000Z'
    });

    expect(nextBranchLogPollRange(state)).toEqual({
      start: '2026-07-11T10:00:00.000Z',
      end: '2026-07-11T10:15:00.000Z'
    });

    ingestBranchLogs(state, []);

    const now = new Date('2026-07-11T10:16:00.000Z');
    expect(nextBranchLogPollRange(state, now).end).toBe('2026-07-11T10:16:00.000Z');
  });

  test('ingest dedupes already seen logs and advances the cursor with overlap', () => {
    const state = createBranchLogFollowState({
      start: '2026-07-11T10:00:00.000Z',
      end: '2026-07-11T10:15:00.000Z'
    });

    const first = ingestBranchLogs(state, [
      makeLog('2026-07-11T10:01:00.000Z', 'one'),
      makeLog('2026-07-11T10:02:00.000Z', 'two')
    ]);
    expect(first.map((log) => log.message)).toEqual(['one', 'two']);

    expect(state.nextStart).toBe('2026-07-11T10:01:55.000Z');

    const second = ingestBranchLogs(state, [
      makeLog('2026-07-11T10:02:00.000Z', 'two'),
      makeLog('2026-07-11T10:03:00.000Z', 'three')
    ]);
    expect(second.map((log) => log.message)).toEqual(['three']);
  });

  test('prunes seen fingerprints older than the cursor', () => {
    const seen = new Map<string, number>([
      ['old', 1_000],
      ['new', 5_000]
    ]);

    pruneSeenLogs(seen, 2_000);

    expect([...seen.keys()]).toEqual(['new']);
  });
});

describe('normalizeBranchLogsError', () => {
  test('maps unavailable errors to a friendly message', () => {
    expect(() => normalizeBranchLogsError(new Error('404 not found'))).toThrow(
      'Branch logs are not available for this branch.'
    );
  });

  test('rethrows other errors unchanged', () => {
    expect(() => normalizeBranchLogsError(new Error('boom'))).toThrow('boom');
  });
});
