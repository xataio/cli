export const formatUtc = (value: string | undefined) =>
  value ? `${new Date(value).toISOString().slice(0, 19).replace('T', ' ')} UTC` : 'unknown';
