import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { CLI_NAME } from '~/lib/constants';
import { config, updateConfig } from '../../lib/config';
import { getActiveProfile } from '../../lib/profile';

type Flags = {};

export async function implementation(this: LocalContext, {}: Flags, profile?: string) {
  const profiles = Object.keys(config.profiles || {});
  let selectedProfile = profile;

  // If no profile provided, show interactive selection
  if (!selectedProfile) {
    if (profiles.length === 1) {
      selectedProfile = profiles[0];
      await updateConfig({ ...config, activeProfile: selectedProfile! });
      console.log(`Switched to the only available profile: "${selectedProfile}"`);
      return;
    }

    const activeProfile = getActiveProfile();
    const choices = profiles.map((profile) => ({
      name: profile,
      message: profile === activeProfile ? `${profile} (current)` : profile
    }));

    selectedProfile = await this.enquirer.selectPrompt(this.isCI, 'Select profile to switch to:', choices);

    if (!selectedProfile) {
      console.log('No profile selected');
      return;
    }
  }

  if (!config.profiles?.[selectedProfile!]) {
    console.log(`Profile "${selectedProfile}" does not exist`);
    return;
  }

  await updateConfig({ ...config, activeProfile: selectedProfile });
  console.log(`Switched to profile "${selectedProfile}"`);
}

export const AuthSwitchCommand = buildCommand({
  docs: {
    brief: `Switch to a different ${CLI_NAME} account profile`
  },
  parameters: {
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'The profile to switch to',
          parse: String,
          optional: true
        }
      ]
    }
  },
  func: implementation
});
