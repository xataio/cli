import { buildCommand } from '@stricli/core';
import { XataApi } from '@xata.io/api';
import chalk from 'chalk';
import { match } from 'ts-pattern';
import type { LocalContext } from '~/context';
import { getAuthClient } from '~/lib/api';
import { config, updateConfig } from '~/lib/config';
import { CLI_NAME, DEFAULT_ENVIRONMENT } from '~/lib/constants';
import { DEFAULT_PROFILE } from '~/lib/profile';
import type { ApiEnvironment, CustomConfig } from '~/lib/schemas';

type Flags = {
  env: ApiEnvironment;
  profile: string;
  force: boolean;
  'custom-issuer'?: string;
  'custom-api-base-url'?: string;
  'custom-client-id'?: string;
  'custom-client-secret'?: string;
};

async function resolveCustomConfig(
  context: LocalContext,
  flags: Pick<Flags, 'custom-issuer' | 'custom-api-base-url' | 'custom-client-id' | 'custom-client-secret'>
): Promise<CustomConfig | undefined> {
  const issuer = await context.enquirer.inputPrompt(context.isInteractive, 'Issuer URL', {
    flag: flags['custom-issuer']
  });
  const apiBaseUrl = await context.enquirer.inputPrompt(context.isInteractive, 'API base URL', {
    flag: flags['custom-api-base-url']
  });
  const clientSecret = await context.enquirer.inputPrompt(context.isInteractive, 'Client secret', {
    flag: flags['custom-client-secret']
  });

  if (!issuer || !apiBaseUrl || !clientSecret) {
    console.error('Issuer URL, API base URL, and client secret are all required for custom environments.');
    return undefined;
  }

  return { issuer, apiBaseUrl, clientSecret, clientId: flags['custom-client-id'] ?? 'cli' };
}

export async function implementation(
  this: LocalContext,
  { env, profile = DEFAULT_PROFILE, force, ...customFlags }: Flags
) {
  const profiles = config?.profiles || {};
  if (profiles[profile] && !force) {
    console.log(`Profile "${profile}" is already logged in. Use --force to log in again.`);
    return;
  } else if (profiles[profile]) {
    // Remove existing profile to ensure a clean state
    const { [profile]: _, ...updatedProfiles } = profiles;
    await updateConfig({ ...config, profiles: updatedProfiles });
  }

  const customConfig = env === 'custom' ? await resolveCustomConfig(this, customFlags) : undefined;
  if (env === 'custom' && !customConfig) return;

  try {
    const client = getAuthClient(env, customConfig);
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
                environment: env,
                accessToken: step.accessToken,
                refreshToken: step.refreshToken,
                expiresAt: step.expiresAt,
                customConfig
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
      env: {
        kind: 'enum',
        values: ['local', 'dev', 'staging', 'prod', 'custom'],
        brief: 'The environment to log in to',
        default: DEFAULT_ENVIRONMENT
      },
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
      'custom-issuer': {
        kind: 'parsed',
        parse: String,
        brief: 'Issuer URL for custom environment',
        optional: true
      },
      'custom-api-base-url': {
        kind: 'parsed',
        parse: String,
        brief: 'API base URL for custom environment',
        optional: true
      },
      'custom-client-id': {
        kind: 'parsed',
        parse: String,
        brief: 'Client ID for custom environment (defaults to "cli")',
        optional: true
      },
      'custom-client-secret': {
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
