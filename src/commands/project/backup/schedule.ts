import { capitalize } from '@xata.io/lang';
import { dayOfWeekMapReverse, formatCronExpression, parseCronExpression } from '@xata.io/utils';

const MIN_RETENTION_DAYS = 2;
const MAX_RETENTION_DAYS = 35;

export type Schedule =
  | { cadence: 'daily'; time: string }
  | { cadence: 'weekly'; dayOfWeek: string; time: string | undefined };

export type ConfigureFlags = {
  retention?: string;
  cadence?: string;
  'day-of-week'?: string;
  time?: string;
};

export type ConfigureChanges = {
  retention?: number;
  cadence?: Schedule['cadence'];
  dayOfWeek?: string;
  time?: string;
};

export type ScheduleError = { error: string };

export const parseConfigureFlags = (flags: ConfigureFlags): ConfigureChanges | ScheduleError => {
  const changes: ConfigureChanges = {};

  if (flags.retention !== undefined) {
    const value = flags.retention.trim();
    const retention = Number(value);
    if (!/^\d+$/.test(value) || retention < MIN_RETENTION_DAYS || retention > MAX_RETENTION_DAYS) {
      return {
        error: `Retention must be a whole number of days between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS}, got "${flags.retention}"`
      };
    }
    changes.retention = retention;
  }
  if (flags.cadence !== undefined) {
    const cadence = flags.cadence.trim().toLowerCase();
    if (cadence !== 'daily' && cadence !== 'weekly') {
      return { error: 'Cadence must be either "daily" or "weekly"' };
    }
    changes.cadence = cadence;
  }
  if (flags['day-of-week'] !== undefined) {
    const dayOfWeek = flags['day-of-week'].trim().toLowerCase();
    if (!Object.hasOwn(dayOfWeekMapReverse, dayOfWeek)) {
      return {
        error: `Invalid day of week "${flags['day-of-week']}". Use one of: ${Object.keys(dayOfWeekMapReverse).join(', ')}`
      };
    }
    changes.dayOfWeek = dayOfWeek;
  }
  if (flags.time !== undefined) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(flags.time)) {
      return { error: `Time must be in 24-hour HH:MM format (UTC), for example 02:30, got "${flags.time}"` };
    }
    changes.time = flags.time;
  }
  if (changes.cadence === 'daily' && changes.dayOfWeek) {
    return { error: '--day-of-week cannot be used with --cadence daily' };
  }

  return changes;
};

export const scheduleFromBackupTime = (backupTime: string | undefined): Schedule => {
  if (!backupTime) return { cadence: 'weekly', dayOfWeek: 'sunday', time: undefined };
  return parseCronExpression(backupTime);
};

export const resolveSchedule = (current: Schedule, changes: ConfigureChanges): Schedule | ScheduleError => {
  const cadence = changes.cadence ?? current.cadence;
  const time = changes.time ?? current.time;

  if (cadence === 'daily') {
    if (changes.dayOfWeek) {
      return { error: '--day-of-week cannot be used when the branch backs up daily' };
    }
    if (!time) return { error: '--time is required when changing the backup schedule' };
    return { cadence, time };
  }

  const dayOfWeek = changes.dayOfWeek ?? (current.cadence === 'weekly' ? current.dayOfWeek : undefined);
  if (!dayOfWeek) {
    return { error: '--day-of-week is required when setting cadence to weekly' };
  }
  if (!time && (changes.cadence !== undefined || changes.dayOfWeek !== undefined)) {
    return { error: '--time is required when changing the backup schedule' };
  }
  return { cadence, dayOfWeek, time };
};

export const toBackupTime = (schedule: Schedule): string | undefined => {
  if (!schedule.time) return undefined;
  if (schedule.cadence === 'daily') return formatCronExpression({ cadence: 'daily', time: schedule.time });
  return formatCronExpression({ cadence: 'weekly', dayOfWeek: schedule.dayOfWeek, time: schedule.time });
};

export const describeSchedule = (schedule: Schedule) => {
  if (schedule.cadence === 'daily') return `daily at ${schedule.time} UTC`;
  const day = capitalize(schedule.dayOfWeek);
  return schedule.time ? `weekly on ${day} at ${schedule.time} UTC` : `weekly on ${day}, time chosen by Xata`;
};
