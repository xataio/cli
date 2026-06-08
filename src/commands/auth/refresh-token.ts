import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { config } from '~/lib/config';
import { getProfile } from '~/lib/profile';

type Flags = {
  profile: string;
};

export async function implementation(this: LocalContext, { profile: profileFlag }: Flags) {
  const profile = getProfile({ profileFlag });

  if (!profile) {
    this.process.stderr.write('You must be logged in to print a token.');
    return;
  }

  if (config.profiles[profile]?.type !== 'oidc') {
    this.process.stderr.write(
      `Profile "${profile}" is using API key authentication and does not have a refresh token.\n` +
        'Please use a profile with session-based authentication to retrieve a refresh token.\n' +
        'You can create a new profile with session-based authentication using the `xata auth login` command.'
    );
    return;
  }

  const refreshToken = config.profiles[profile]?.refreshToken ?? '';
  this.process.stdout.write(refreshToken);
}

export const AuthRefreshTokenCommand = buildCommand({
  docs: {
    brief: 'Print the current refresh token'
  },
  parameters: {
    flags: {
      profile: {
        kind: 'parsed',
        parse: String,
        brief: 'The profile to use',
        default: 'default'
      }
    }
  },
  func: implementation
});
