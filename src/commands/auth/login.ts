import { buildCommand } from '@stricli/core';
import { XataApi } from '@xata.io/api';
import chalk from 'chalk';
import { match } from 'ts-pattern';
import type { LocalContext } from '~/context';
import { getAuthConfig } from '~/lib/api';
import { config, updateConfig } from '~/lib/config';
import { PRODUCT_NAME } from '~/lib/constants';
import { DEFAULT_PROFILE } from '~/lib/profile';
import { isSessionValid } from '~/lib/session';

type Flags = {
  profile: string;
  force: boolean;
  'api-key'?: string;
  issuer?: string;
  'api-url'?: string;
  'client-id'?: string;
  'client-secret'?: string;
};

export async function implementation(this: LocalContext, { profile = DEFAULT_PROFILE, force, ...customFlags }: Flags) {
  const profiles = config?.profiles || {};
  if (profiles[profile] && !force) {
    if (await isSessionValid(profile, profiles[profile])) {
      console.log(`Profile "${profile}" is already logged in. Use --force to log in again.`);
      return;
    }

    console.log(`The session for profile "${profile}" has expired, logging in again.`);
  }

  const storedConfig = profiles[profile]?.customConfig;
  const { baseUrl, client } = getAuthConfig({
    clientId: customFlags['client-id'] ?? storedConfig?.clientId,
    clientSecret: customFlags['client-secret'] ?? storedConfig?.clientSecret,
    issuer: customFlags.issuer ?? storedConfig?.issuer,
    apiBaseUrl: customFlags['api-url'] ?? storedConfig?.apiBaseUrl
  });

  // Passing --api-key is a non-interactive alternative to the device OAuth flow below.
  const apiKey = customFlags['api-key'];
  if (apiKey) {
    await loginWithApiKey.call(this, { profile, apiKey, baseUrl });
    return;
  }

  try {
    for await (const step of XataApi.deviceLogin(client)) {
      await match(step)
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
    this.process.exit(1);
  }
}

async function loginWithApiKey(
  this: LocalContext,
  { profile, apiKey, baseUrl }: { profile: string; apiKey: string; baseUrl: string }
) {
  // Validate the API key before persisting it so we don't store an invalid one.
  try {
    const xata = new XataApi({ baseUrl, token: apiKey });
    await xata.api.organizations.getOrganizationsList({});
  } catch {
    console.error('The provided API key is invalid or could not be verified. No changes were made.');
    this.process.exit(1);
    return;
  }

  await updateConfig({
    ...config,
    activeProfile: profile,
    profiles: {
      ...(config?.profiles || {}),
      [profile]: {
        type: 'apiKey',
        apiKey,
        customConfig: { apiBaseUrl: baseUrl }
      }
    }
  });

  console.log(`Logged in with profile "${profile}" using an API key.`);
}

export const AuthLoginCommand = buildCommand({
  docs: {
    brief: `Log in to a ${PRODUCT_NAME} account`,
    fullDescription:
      'Prints a URL and a code to authorize this machine, or stores an API key with `--api-key` for non-interactive use. The issuer, API URL and client flags log in against a deployment other than production, which is how Enterprise customers connect the CLI to a custom deployment in their own cloud. Omit them and the CLI uses the default production values.',
    customUsage: [
      { input: '--api-key xau_...', brief: 'Log in from a script or CI' },
      { input: '--profile staging', brief: 'Log in as another profile' },
      { input: '--profile staging --api-url https://api.staging.example.com', brief: 'Log in to another deployment' }
    ]
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
      'api-key': {
        kind: 'parsed',
        parse: String,
        brief: 'Log in non-interactively with an API key instead of the browser OAuth flow',
        optional: true
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
