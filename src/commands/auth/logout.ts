import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { config, updateConfig } from '~/lib/config';
import { CLI_NAME } from '~/lib/constants';
import { getProfile } from '~/lib/profile';
import { revokeSession } from '~/lib/session';

type Flags = {
  profile: string;
  yes: boolean;
  local: boolean;
};

export async function implementation(this: LocalContext, { profile: profileFlag, yes, local }: Flags) {
  const profile = getProfile({ profileFlag });
  const profileData = config.profiles[profile];
  if (!profileData) {
    console.log(`Profile "${profile}" does not exist. You are already logged out.`);
    return;
  }

  const revokes = profileData.type === 'oidc' && !local;

  if (!yes) {
    const confirmFromPrompt = await this.enquirer.confirmPrompt(
      this.isInteractive,
      revokes
        ? `Do you want to log out of the profile ${profile}? This revokes its session, which may also sign out other CLI installations authorized from the same browser.`
        : `Do you want to log out of the profile ${profile}`
    );
    if (!confirmFromPrompt) {
      this.process.stderr.write(`Aborted as there was no confirmation. Didn't log out.\n`);
      this.process.exit(1);
      return;
    }
  }

  if (revokes) {
    try {
      await revokeSession(profile);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.process.stderr.write(
        `Could not revoke the session of profile "${profile}": ${message}\n` +
          `The local credentials were kept. Retry, or run \`${CLI_NAME} auth logout --local --profile ${profile}\` to remove them without revoking the session.\n`
      );
      this.process.exit(1);
      return;
    }
  }

  const updatedProfiles = { ...config.profiles };
  delete updatedProfiles[profile];
  const activeProfile = this.getActiveProfile() === profile ? '' : config.activeProfile;

  try {
    await updateConfig({ ...config, activeProfile, profiles: updatedProfiles });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    this.process.stderr.write(
      revokes
        ? `Revoked the session of profile "${profile}" but could not remove the local credentials: ${message}\n` +
            `Run \`${CLI_NAME} auth logout --local --profile ${profile}\` to remove them.\n`
        : `Could not remove the local credentials of profile "${profile}": ${message}\n`
    );
    this.process.exit(1);
    return;
  }

  if (revokes) {
    console.log(`Revoked the session and removed the local credentials of profile "${profile}".`);
  } else if (profileData.type === 'oidc') {
    console.log(
      `Removed the local credentials of profile "${profile}". The session was not revoked and stays active until it expires or is revoked from your account settings.`
    );
  } else {
    console.log(`Logged out of profile "${profile}"`);
  }
}

export const AuthLogoutCommand = buildCommand({
  docs: {
    brief: 'Log out of the current account',
    fullDescription:
      'Revokes the session of the profile with the identity provider and removes the stored credentials. Because the CLI is a single application to the identity provider, revoking may also sign out other CLI installations that were authorized from the same browser session. Use `--local` when the identity provider is unreachable to remove the stored credentials without revoking the session. Profiles that use an API key are only removed locally; the key itself stays valid.'
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
      },
      local: {
        kind: 'boolean',
        brief: 'Only remove the stored credentials, do not revoke the session with the identity provider',
        default: false
      }
    }
  },
  func: implementation
});
