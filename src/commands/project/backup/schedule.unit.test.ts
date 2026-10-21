import { describe, expect, test } from 'bun:test';
import {
  describeSchedule,
  parseConfigureFlags,
  resolveSchedule,
  scheduleFromBackupTime,
  toBackupTime
} from './schedule';

describe('parseConfigureFlags', () => {
  test('normalizes case and converts retention', () => {
    expect(
      parseConfigureFlags({ cadence: 'Weekly', 'day-of-week': 'FRIDAY', time: '03:00', retention: ' 7 ' })
    ).toEqual({
      cadence: 'weekly',
      dayOfWeek: 'friday',
      time: '03:00',
      retention: 7
    });
  });

  test.each([
    { retention: '' },
    { retention: '1' },
    { retention: '36' },
    { retention: '2.5' },
    { retention: '1e1' },
    { time: '24:00' },
    { time: '2:30' },
    { cadence: 'monthly' },
    { 'day-of-week': 'someday' },
    { 'day-of-week': 'constructor' },
    { cadence: 'daily', 'day-of-week': 'monday' }
  ])('rejects %p', (flags) => {
    expect(parseConfigureFlags(flags)).toHaveProperty('error');
  });
});

describe('resolveSchedule', () => {
  const weeklyMonday = scheduleFromBackupTime('1:04:00');
  const daily = scheduleFromBackupTime('*:04:00');
  const unset = scheduleFromBackupTime(undefined);

  test('keeps the current day when only the time changes', () => {
    expect(resolveSchedule(weeklyMonday, { time: '05:15' })).toEqual({
      cadence: 'weekly',
      dayOfWeek: 'monday',
      time: '05:15'
    });
  });

  test('rejects a day of week on a daily branch', () => {
    expect(resolveSchedule(daily, { dayOfWeek: 'monday' })).toHaveProperty('error');
  });

  test('requires a day when switching from daily to weekly', () => {
    expect(resolveSchedule(daily, { cadence: 'weekly' })).toHaveProperty('error');
    expect(resolveSchedule(daily, { cadence: 'weekly', dayOfWeek: 'tuesday' })).toEqual({
      cadence: 'weekly',
      dayOfWeek: 'tuesday',
      time: '04:00'
    });
  });

  test('keeps a branch without an explicit time on retention-only changes', () => {
    const schedule = resolveSchedule(unset, {});
    expect(schedule).toEqual({ cadence: 'weekly', dayOfWeek: 'sunday', time: undefined });
    expect('error' in schedule ? undefined : toBackupTime(schedule)).toBeUndefined();
  });

  test('requires a time to change the day of a branch without one', () => {
    expect(resolveSchedule(unset, { dayOfWeek: 'monday' })).toHaveProperty('error');
    expect(resolveSchedule(unset, { time: '03:00' })).toEqual({
      cadence: 'weekly',
      dayOfWeek: 'sunday',
      time: '03:00'
    });
  });
});

describe('describeSchedule', () => {
  test.each([
    [undefined, 'weekly on Sunday, time chosen by Xata'],
    ['1:04:00', 'weekly on Monday at 04:00 UTC'],
    ['*:23:30', 'daily at 23:30 UTC']
  ])('describes %p', (backupTime, expected) => {
    expect(describeSchedule(scheduleFromBackupTime(backupTime))).toBe(expected);
  });
});

describe('toBackupTime', () => {
  test.each(['*:04:00', '1:04:00', '0:02:15'])('round trips %s', (backupTime) => {
    expect(toBackupTime(scheduleFromBackupTime(backupTime))).toBe(backupTime);
  });
});
