import { describe, expect, test } from 'bun:test';
import type { Types } from '@xata.io/api';
import { appendLogs, logLevelsForFilter } from './logs';

function makeLog(message: string): Types.LogEntry {
  return {
    timestamp: '2026-07-11T10:00:00.000Z',
    level: 'info',
    instanceID: 'inst-1',
    process: 'postgres',
    message
  } as Types.LogEntry;
}

describe('log level filter', () => {
  test('maps filter to level list', () => {
    expect(logLevelsForFilter('all')).toEqual([]);
    expect(logLevelsForFilter('error')).toEqual(['error']);
  });
});

describe('appendLogs', () => {
  test('returns the same buffer when nothing is appended', () => {
    const buffer = [makeLog('one')];
    expect(appendLogs(buffer, [])).toBe(buffer);
  });

  test('appends and keeps only the newest entries up to the limit', () => {
    const buffer = [makeLog('one'), makeLog('two')];
    const result = appendLogs(buffer, [makeLog('three'), makeLog('four')], 3);
    expect(result.map((log) => log.message)).toEqual(['two', 'three', 'four']);
  });
});
