import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { resolveProfile } from '~/lib/profile';

export async function implementation(this: LocalContext, _flags: Record<string, never>) {
  const { profile, profileData } = resolveProfile({ profileFlag: this.profile });

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
    flags: {}
  },
  func: implementation
});
