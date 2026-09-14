import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { PRODUCT_NAME } from '~/lib/constants';
import { config } from '../../lib/config';
import { getUserInfo, printCustom, printTable } from '../../lib/cli-utils';
import { getActiveProfile } from '../../lib/profile';

export async function implementation(this: LocalContext) {
  const profiles = Object.keys(config.profiles || {});

  if (profiles.length === 0) {
    printCustom(this, [], () => {
      this.process.stdout.write('No profiles found. Please log in first using "auth login"\n');
    });
    return;
  }

  const activeProfile = getActiveProfile();

  const profileData = profiles.map((profile) => {
    const profileConfig = config.profiles?.[profile];
    const isCurrent = profile === activeProfile;
    const userInfo = getUserInfo(profile);

    return {
      profile,
      type: profileConfig?.type || 'unknown',
      email: userInfo.email || '-',
      name: userInfo.name || '-',
      current: isCurrent
    };
  });

  const headers = ['profile', 'type', 'email', 'name', 'current'];
  const rows = profileData.map((data) => [data.profile, data.type, data.email, data.name, data.current ? '✓' : '']);

  printTable(this, profileData, headers, rows);
}

export const AuthListCommand = buildCommand({
  docs: {
    brief: `List all available ${PRODUCT_NAME} account profiles`
  },
  parameters: {
    flags: {}
  },
  func: implementation
});
