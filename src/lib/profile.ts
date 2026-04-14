import { env } from 'bun';
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

export function getActiveProfile() {
  if (env.XATA_API_KEY) {
    return '__env';
  }
  return config?.activeProfile;
}
