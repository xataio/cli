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
