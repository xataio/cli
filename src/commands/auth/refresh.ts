import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { getProfileApi } from '~/lib/api';
import { config } from '~/lib/config';
import { CLI_NAME } from '~/lib/constants';
import { getProfile } from '~/lib/profile';

type Flags = {
  profile?: string;
  json: boolean;
};

export async function implementation(this: LocalContext, { profile: profileFlag, json }: Flags) {
  const profile = getProfile({ profileFlag });
  const profileData = config.profiles[profile];

  if (!profileData) {
    this.process.stderr.write(
      `You are not logged in with profile "${profile}". Please use \`${CLI_NAME} auth login\` to log in.\n`
    );
    this.process.exit(1);
    return;
  }

  if (profileData.type !== 'oidc') {
    this.process.stderr.write(
      `Profile "${profile}" is using API key authentication and does not have a session to refresh.\n`
    );
    this.process.exit(1);
    return;
  }

  const api = getProfileApi(profile);
  await api.refreshToken({ force: true });

  const token = api.token;
  if (typeof token !== 'object' || token === null) {
    throw new Error(`Could not read the refreshed session of profile "${profile}"`);
  }

  const expiresAt = token.expiresAt.toISOString();
  this.print(this, json, { profile, expiresAt }, ['profile', 'expires_at'], [[profile, expiresAt]]);
}

export const AuthRefreshCommand = buildCommand({
  docs: {
    brief: 'Refresh the access token of the current session',
    fullDescription:
      'Refreshes the session even when the current access token is still valid, and stores the new one. Every command already refreshes on its own when the token is about to expire, so this is for scripts that want to fail early, or to rotate the token before a long job.'
  },
  parameters: {
    flags: {
      profile: {
        kind: 'parsed',
        parse: String,
        brief: 'The profile to refresh',
        optional: true
      },
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      }
    }
  },
  func: implementation
});
