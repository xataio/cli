import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { getUserInfo } from '~/lib/cli-utils';
import { getProfile } from '~/lib/profile';
import { config } from '../../lib/config';

type Flags = {
  profile?: string;
};

export async function implementation(this: LocalContext, { profile: profileFlag }: Flags) {
  const profile = getProfile({ profileFlag });
  if (!config.profiles[profile]) {
    console.log(`You are not logged in with profile "${profile}"`);
    return;
  }

  const { environment } = config.profiles[profile]!;
  const { name = 'unknown', email } = getUserInfo(profileFlag);
  const displayName = `${name}${email ? ` <${email}>` : ''}`;

  console.log(`Logged in to ${environment} with profile "${profile}" as ${displayName}`);
}

export const AuthStatusCommand = buildCommand({
  docs: {
    brief: 'Display active account and authentication state'
  },
  parameters: {
    flags: {
      profile: {
        kind: 'parsed',
        parse: String,
        brief: 'The profile to log in to',
        optional: true
      }
    }
  },
  func: implementation
});
