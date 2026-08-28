import { buildConnectionString } from '@xata.io/sql';

const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);
const SECRET_FLAGS = new Set([
  'password',
  'secret',
  'token',
  'api-key',
  'client-secret',
  'access-token',
  'refresh-token'
]);

/**
 * A connection string carries its password inline, so mask it with the helper the rest of the
 * CLI already prints connection strings through. Other URLs keep their scheme and are only
 * touched when they actually carry a password.
 */
export const maskSecrets = (key: string, value: string) => {
  if (SECRET_FLAGS.has(key.toLowerCase())) {
    return '******';
  }

  const url = URL.parse(value);
  if (!url) {
    return value;
  }
  if (POSTGRES_PROTOCOLS.has(url.protocol)) {
    return buildConnectionString(value, { mask: true });
  }
  if (url.password) {
    url.password = '******';
    return url.toString();
  }
  return value;
};

const redactValue = (key: string, value: unknown): unknown => {
  if (typeof value === 'string') {
    return maskSecrets(key, value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => {
      return redactValue(key, entry);
    });
  }
  if (value && typeof value === 'object') {
    return redact(value as Record<string, unknown>);
  }
  return value;
};

export const redact = (payload: Record<string, unknown>): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      return [key, redactValue(key, value)];
    })
  );
};

/**
 * The flag dumps print whatever the user passed, which for `--source-url` and `--postgres-url`
 * includes the password. They also go to stderr so `--json` output stays parseable.
 */
export const debugDump = (label: string, payload: Record<string, unknown>) => {
  console.error(`DEBUG: ${label}`, redact(payload));
};
