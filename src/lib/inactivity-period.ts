export const inactivityPeriodError = (value: string): string | null => {
  const minutes = Number(value);
  return !/\D/.test(value) && minutes >= 1 && minutes <= 1440
    ? null
    : 'Inactivity period must be a whole number of minutes between 1 and 1440';
};

export const parseInactivityPeriod = (value: string): number => {
  const error = inactivityPeriodError(value);
  if (error) {
    throw new Error(error);
  }
  return Number(value);
};
