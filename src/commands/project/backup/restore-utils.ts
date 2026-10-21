const RFC_3339 =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/i;
const DURATION = /^(\d+)([smh])$/;
const DURATION_UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000 };
export const MAX_TIMEOUT_MS = 24 * 3_600_000;

export type RestoreWindow = {
  earliestRestore: string;
  latestRestore?: string;
};

export const parseRestoreTime = (value: string) => {
  const day = value.slice(0, 10);
  if (!RFC_3339.test(value) || !new Date(day).toISOString().startsWith(day)) {
    return undefined;
  }
  return new Date(value.toUpperCase()).toISOString();
};

export const parseTimeout = (value: string) => {
  const match = DURATION.exec(value);
  const amount = Number(match?.[1]);
  const unit = match?.[2];
  if (amount === 0 || (unit !== 's' && unit !== 'm' && unit !== 'h')) {
    return undefined;
  }
  const timeoutMs = amount * DURATION_UNIT_MS[unit];
  return timeoutMs > MAX_TIMEOUT_MS ? undefined : timeoutMs;
};

export const formatRfc3339 = (value: string | number) => {
  const iso = new Date(value).toISOString();
  return iso.endsWith('.000Z') ? `${iso.slice(0, 19)}Z` : iso;
};

const ceilToSecond = (value: string) => Math.ceil(new Date(value).getTime() / 1000) * 1000;
const floorToSecond = (value: string) => Math.floor(new Date(value).getTime() / 1000) * 1000;

export const formatEarliestRestore = (value: string | undefined) =>
  value ? formatRfc3339(ceilToSecond(value)) : 'unknown';
export const formatLatestRestore = (value: string | undefined) =>
  value ? formatRfc3339(floorToSecond(value)) : 'unknown';

export const describeWindow = ({ earliestRestore, latestRestore }: RestoreWindow) =>
  `${formatEarliestRestore(earliestRestore)} to ${latestRestore ? formatLatestRestore(latestRestore) : 'now'}`;

export const windowError = (targetTime: string, window: RestoreWindow, now: Date) => {
  const target = new Date(targetTime).getTime();
  const shown = formatRfc3339(target);
  const hint = `The restore window is ${describeWindow(window)}.`;
  if (target > now.getTime()) {
    return `The target time ${shown} is in the future. ${hint}`;
  }
  if (target < ceilToSecond(window.earliestRestore)) {
    return `The target time ${shown} is before the earliest recovery point. ${hint}`;
  }
  if (window.latestRestore && target > floorToSecond(window.latestRestore)) {
    return `The target time ${shown} is after the latest recovery point. ${hint}`;
  }
  return null;
};
