import { describe, expect, test } from 'bun:test';
import { sortBranchLogsChronologically } from '@xata.io/utils';
import { buildFilters, buildTimeRange, formatCsvLogs, formatRawLog, parseLogTime, pruneSeenLogs } from './logs';

describe('branch logs helpers', () => {
  test('parses relative log times from now', () => {
    const now = new Date('2026-05-23T12:00:00.000Z');

    expect(parseLogTime('15m', 'start', now)).toBe('2026-05-23T11:45:00.000Z');
    expect(parseLogTime('1h', 'end', now)).toBe('2026-05-23T11:00:00.000Z');
  });

  test('shows the expected timestamp format for invalid start and end times', () => {
    expect(() => parseLogTime('10', 'start')).toThrow(
      'Invalid --start time: 10. Use format YYYY-MM-DDTHH:mm:ss.sssZ, for example 2026-05-23T10:00:00.000Z, or a relative duration like 15m, 1h, or 7d.'
    );

    expect(() => parseLogTime('tomorrow', 'end')).toThrow(
      'Invalid --end time: tomorrow. Use format YYYY-MM-DDTHH:mm:ss.sssZ, for example 2026-05-23T10:00:00.000Z, or a relative duration like 15m, 1h, or 7d.'
    );
  });

  test('builds default one hour time range', () => {
    const now = new Date('2026-05-23T12:00:00.000Z');

    expect(buildTimeRange({}, now)).toEqual({
      start: '2026-05-23T11:00:00.000Z',
      end: '2026-05-23T12:00:00.000Z'
    });
  });

  test('requires start time to be before end time', () => {
    expect(() => buildTimeRange({ start: '2026-05-23T12:00:00.000Z', end: '2026-05-23T12:00:00.000Z' })).toThrow(
      'Start time must be before end time.'
    );
  });

  test('builds branch log filters', () => {
    expect(
      buildFilters({
        level: ['error', 'warning'],
        instance: ['instance-1'],
        process: ['postgres'],
        search: 'timeout'
      })
    ).toEqual([
      { field: 'level', op: 'in', values: ['error', 'warning'] },
      { field: 'instance', op: 'in', values: ['instance-1'] },
      { field: 'process', op: 'in', values: ['postgres'] },
      { field: 'body', op: 'icontains', value: 'timeout' }
    ]);
  });

  test('validates search length', () => {
    expect(() =>
      buildFilters({
        level: [],
        instance: [],
        process: [],
        search: 'x'.repeat(1025)
      })
    ).toThrow('--search must be 1024 characters or fewer.');
  });

  test('formats human output as one raw log line', () => {
    expect(
      formatRawLog({
        timestamp: '2026-05-23T12:00:00.000Z',
        level: 'error',
        instanceID: 'instance-1',
        process: 'postgres',
        message: 'long message that should not be folded into a table cell'
      })
    ).toBe(
      '2026-05-23T12:00:00.000Z [error instance-1 postgres] long message that should not be folded into a table cell'
    );
  });

  test('formats CSV output with escaped values', () => {
    expect(
      formatCsvLogs([
        {
          timestamp: '2026-05-23T12:00:00.000Z',
          level: 'error',
          instanceID: 'instance-1',
          process: 'postgres',
          message: 'message with "quotes", comma, and\nnewline'
        }
      ])
    ).toBe(
      'timestamp,level,instanceID,process,message\n"2026-05-23T12:00:00.000Z","error","instance-1","postgres","message with ""quotes"", comma, and\nnewline"'
    );
  });

  test('formats CSV rows without a header for streaming after the first write', () => {
    expect(
      formatCsvLogs(
        [
          {
            timestamp: '2026-05-23T12:00:00.000Z',
            instanceID: 'instance-1',
            message: 'message'
          }
        ],
        false
      )
    ).toBe('"2026-05-23T12:00:00.000Z","","instance-1","","message"');
  });

  test('sorts logs oldest first so latest appears at the bottom', () => {
    const logs = [
      {
        timestamp: '2026-05-23T12:00:02.000Z',
        instanceID: 'instance-1',
        message: 'latest'
      },
      {
        timestamp: '2026-05-23T12:00:00.000Z',
        instanceID: 'instance-1',
        message: 'oldest'
      },
      {
        timestamp: '2026-05-23T12:00:01.000Z',
        instanceID: 'instance-1',
        message: 'middle'
      }
    ];

    expect(sortBranchLogsChronologically(logs).map((log) => log.message)).toEqual(['oldest', 'middle', 'latest']);
  });

  test('prunes follow mode dedupe entries outside the overlap window', () => {
    const seen = new Map([
      ['old', new Date('2026-05-23T11:59:54.999Z').getTime()],
      ['overlap-start', new Date('2026-05-23T11:59:55.000Z').getTime()],
      ['new', new Date('2026-05-23T12:00:00.000Z').getTime()]
    ]);

    pruneSeenLogs(seen, new Date('2026-05-23T11:59:55.000Z').getTime());

    expect([...seen.keys()]).toEqual(['overlap-start', 'new']);
  });
});
