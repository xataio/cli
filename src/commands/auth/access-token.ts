import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
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

  const accessToken = await this.refreshToken();
  this.process.stdout.write(accessToken);
}

export const AuthAccessTokenCommand = buildCommand({
  docs: {
    brief: 'Print the current access token'
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
