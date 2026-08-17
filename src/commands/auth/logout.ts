import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { config, updateConfig } from '~/lib/config';
import { getProfile } from '~/lib/profile';

type Flags = {
  profile: string;
  yes: boolean;
};

export async function implementation(this: LocalContext, { profile: profileFlag, yes }: Flags) {
  const profile = getProfile({ profileFlag });
  if (!config.profiles[profile]) {
    console.log(`Profile "${profile}" does not exist. You are already logged out.`);
    return;
  }

  const updatedProfiles = { ...config.profiles };
  delete updatedProfiles[profile];

  if (!yes) {
    const confirmFromPrompt = await this.enquirer.confirmPrompt(
      this.isInteractive,
      `Do you want to log out of the profile ${profile}`
    );
    if (!confirmFromPrompt) {
      return new Error(`Aborted as there was no confirmation. Didn't log out.`);
    }
  }

  const activeProfile = this.getActiveProfile();
  if (activeProfile === profile) {
    config.activeProfile = '';
  }

  await updateConfig({ ...config, profiles: updatedProfiles });
  console.log(`Logged out of profile "${profile}"`);
}

export const AuthLogoutCommand = buildCommand({
  docs: {
    brief: 'Log out of the current account'
  },
  parameters: {
    flags: {
      profile: {
        kind: 'parsed',
        parse: String,
        brief: 'The profile to log out of',
        default: 'default'
      },
      yes: {
        kind: 'boolean',
        brief: 'Do not ask for confirmation, assume yes.',
        default: false
      }
    }
  },
  func: implementation
});
