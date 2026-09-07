import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { resolveProfile } from '~/lib/profile';

type Flags = {
  profile: string;
};

export async function implementation(this: LocalContext, { profile: profileFlag }: Flags) {
  const { profile, profileData } = resolveProfile({ profileFlag });

  if (!profileData) {
    this.process.stderr.write(`Profile "${profile}" does not exist.\n`);
    this.process.exit(1);
    return;
  }

  if (profileData.type !== 'oidc') {
    this.process.stderr.write(
      `Profile "${profile}" is using API key authentication and does not have a refresh token.\n` +
        'Please use a profile with session-based authentication to retrieve a refresh token.\n' +
        'You can create a new profile with session-based authentication using the `xata auth login` command.'
    );
    return;
  }

  this.process.stdout.write(profileData.refreshToken);
}

export const AuthRefreshTokenCommand = buildCommand({
  docs: {
    brief: 'Print the stored refresh token, without refreshing the session'
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
