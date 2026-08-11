import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { PRODUCT_NAME } from '~/lib/constants';
import { config } from '../../lib/config';
import { print, getUserInfo } from '../../lib/cli-utils';
import { getActiveProfile } from '../../lib/profile';

type Flags = {
  json?: boolean;
};

export async function implementation(this: LocalContext, { json }: Flags) {
  const profiles = Object.keys(config.profiles || {});

  if (profiles.length === 0) {
    if (json) {
      print(this, true, []);
    } else {
      console.log('No profiles found. Please log in first using "auth login"');
    }
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

  if (json) {
    print(this, true, profileData);
  } else {
    const headers = ['profile', 'type', 'email', 'name', 'current'];
    const rows = profileData.map((data) => [data.profile, data.type, data.email, data.name, data.current ? '✓' : '']);

    print(this, false, profileData, headers, rows);
  }
}

export const AuthListCommand = buildCommand({
  docs: {
    brief: `List all available ${PRODUCT_NAME} account profiles`
  },
  parameters: {
    flags: {
      json: {
        kind: 'boolean',
        optional: true,
        brief: 'Output in JSON format'
      }
    }
  },
  func: implementation
});
