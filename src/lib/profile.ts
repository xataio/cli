import { env } from 'bun';
import { parseArgs } from 'node:util';
import { config } from './config';

export const DEFAULT_PROFILE = 'default';

export function getProfile({ profileFlag = '' }: { profileFlag?: string }) {
  if (config?.profiles?.[profileFlag]) {
    return profileFlag;
  }

  const activeProfile = getActiveProfile();
  if (config?.profiles?.[activeProfile]) {
    return config.activeProfile;
  }

  return Object.keys(config?.profiles ?? {})[0] ?? DEFAULT_PROFILE;
}

/**
 * Reads `--profile` out of the raw arguments, because the context, and with it
 * the API client, is built before stricli parses the command's flags. Anything
 * malformed is left for stricli to report.
 */
export function getProfileFlag(args: readonly string[]) {
  try {
    const { values } = parseArgs({
      args: [...args],
      options: { profile: { type: 'string' } },
      strict: false,
      allowPositionals: true
    });

    return typeof values.profile === 'string' ? values.profile : undefined;
  } catch {
    return undefined;
  }
}

export function getActiveProfile() {
  if (env.XATA_API_KEY) {
    return '__env';
  }
  return config?.activeProfile;
}
