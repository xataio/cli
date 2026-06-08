import { buildCommand } from '@stricli/core';
import { XataApi } from '@xata.io/api';
import chalk from 'chalk';
import { match } from 'ts-pattern';
import type { LocalContext } from '~/context';
import { getAuthConfig } from '~/lib/api';
import { config, updateConfig } from '~/lib/config';
import { CLI_NAME } from '~/lib/constants';
import { DEFAULT_PROFILE } from '~/lib/profile';

type Flags = {
  profile: string;
  force: boolean;
  issuer?: string;
  'api-url'?: string;
  'client-id'?: string;
  'client-secret'?: string;
};

export async function implementation(this: LocalContext, { profile = DEFAULT_PROFILE, force, ...customFlags }: Flags) {
  const profiles = config?.profiles || {};
  if (profiles[profile] && !force) {
    console.log(`Profile "${profile}" is already logged in. Use --force to log in again.`);
    return;
  } else if (profiles[profile]) {
    // Remove existing profile to ensure a clean state
    const { [profile]: _, ...updatedProfiles } = profiles;
    await updateConfig({ ...config, profiles: updatedProfiles });
  }

  try {
    const { baseUrl, client } = getAuthConfig({
      clientId: customFlags['client-id'],
      clientSecret: customFlags['client-secret'],
      issuer: customFlags.issuer,
      apiBaseUrl: customFlags['api-url']
    });

    for await (const step of XataApi.deviceLogin(client)) {
      match(step)
        .with({ type: 'prompt' }, (step) => {
          console.log(`Visit ${chalk.bold.underline(step.verifyUrl)} and enter the code: ${chalk.bold(step.userCode)}`);
          console.log(
            chalk.gray(
              `Using profile ${chalk.bold(profile)}. To login with another profile use --profile <profile> flag.`
            )
          );
        })
        .with({ type: 'token' }, async (step) => {
          await updateConfig({
            ...config,
            activeProfile: profile,
            profiles: {
              ...profiles,
              [profile]: {
                type: 'oidc',
                accessToken: step.accessToken,
                refreshToken: step.refreshToken,
                expiresAt: step.expiresAt,
                customConfig: {
                  ...client,
                  apiBaseUrl: baseUrl
                }
              }
            }
          });
        })
        .exhaustive();
    }
  } catch (error) {
    console.error('Failed to initiate device flow.', error);
  }
}

export const AuthLoginCommand = buildCommand({
  docs: {
    brief: `Log in to a ${CLI_NAME} account`
  },
  parameters: {
    flags: {
      profile: {
        kind: 'parsed',
        parse: String,
        brief: 'The profile to log in to',
        default: 'default'
      },
      force: {
        kind: 'boolean',
        brief: 'Force login even if already logged in',
        default: false
      },
      issuer: {
        kind: 'parsed',
        parse: String,
        brief: 'Issuer URL for custom environment',
        optional: true
      },
      'api-url': {
        kind: 'parsed',
        parse: String,
        brief: 'API base URL for custom environment',
        optional: true
      },
      'client-id': {
        kind: 'parsed',
        parse: String,
        brief: 'Client ID for custom environment (defaults to "cli")',
        optional: true
      },
      'client-secret': {
        kind: 'parsed',
        parse: String,
        brief: 'Client secret for custom environment',
        optional: true
      }
    },
    aliases: {
      f: 'force'
    }
  },
  func: implementation
});
