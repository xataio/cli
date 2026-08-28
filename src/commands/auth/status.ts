import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { getUserInfo } from '~/lib/cli-utils';
import { getProfile } from '~/lib/profile';
import { getSessionExpiry } from '~/lib/session';
import { config } from '../../lib/config';
import { CLI_NAME, DEFAULT_API_BASE_URL } from '~/lib/constants';

type Flags = {
  profile?: string;
};

export function implementation(this: LocalContext, { profile: profileFlag }: Flags) {
  const profile = getProfile({ profileFlag });
  const profileData = config.profiles[profile];
  if (!profileData) {
    console.log(`You are not logged in with profile "${profile}"`);
    return;
  }

  const expiresAt = getSessionExpiry(profileData);
  if (expiresAt && expiresAt <= new Date()) {
    this.process.stderr.write(
      `The session for profile "${profile}" expired on ${expiresAt.toISOString()}. Please use \`${CLI_NAME} auth login\` to log in again.\n`
    );
    this.process.exit(1);
    return;
  }

  const { name = 'unknown', email } = getUserInfo(profileFlag);
  const displayName = `${name}${email ? ` <${email}>` : ''}`;
  const apiBaseUrl = profileData.customConfig?.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  const environment = apiBaseUrl === DEFAULT_API_BASE_URL ? 'production' : apiBaseUrl;

  console.log(`Logged in to ${environment} with profile "${profile}" as ${displayName}`);
  if (expiresAt) {
    console.log(`Session expires on ${expiresAt.toISOString()}.`);
  }
}

export const AuthStatusCommand = buildCommand({
  docs: {
    brief: 'Display active account and authentication state',
    fullDescription:
      'Reads the stored session without contacting the server, so it stays fast and works offline. It reports an expiry the stored session has already passed, but it cannot see a session revoked server-side. Use `xata auth refresh` to verify against the server.'
  },
  parameters: {
    flags: {
      profile: {
        kind: 'parsed',
        parse: String,
        brief: 'The profile to check',
        optional: true
      }
    }
  },
  func: implementation
});
