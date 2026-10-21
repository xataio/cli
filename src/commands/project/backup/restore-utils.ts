import { formatUtc } from './format';

const RFC_3339 =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/;
const DURATION = /^(\d+)([smh])$/;
const DURATION_UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000 };

export type RestoreWindow = {
  earliestRestore: string;
  latestRestore?: string;
};

export const parseRestoreTime = (value: string) => {
  const day = value.slice(0, 10);
  if (!RFC_3339.test(value) || !new Date(day).toISOString().startsWith(day)) {
    return undefined;
  }
  return new Date(value).toISOString();
};

export const parseTimeout = (value: string) => {
  const match = DURATION.exec(value);
  const amount = Number(match?.[1]);
  const unit = match?.[2];
  if (amount === 0 || (unit !== 's' && unit !== 'm' && unit !== 'h')) {
    return undefined;
  }
  return amount * DURATION_UNIT_MS[unit];
};

export const describeWindow = ({ earliestRestore, latestRestore }: RestoreWindow) =>
  `${formatUtc(earliestRestore)} to ${latestRestore ? formatUtc(latestRestore) : 'now'}`;

export const windowError = (targetTime: string, window: RestoreWindow, now: Date) => {
  const target = new Date(targetTime).getTime();
  const hint = `The restore window is ${describeWindow(window)}.`;
  if (target > now.getTime()) {
    return `The target time ${formatUtc(targetTime)} is in the future. ${hint}`;
  }
  if (target < new Date(window.earliestRestore).getTime()) {
    return `The target time ${formatUtc(targetTime)} is before the earliest recovery point. ${hint}`;
  }
  if (window.latestRestore && target > new Date(window.latestRestore).getTime()) {
    return `The target time ${formatUtc(targetTime)} is after the latest recovery point. ${hint}`;
  }
  return null;
};
