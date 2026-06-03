import { type ApiOptions, XataApi } from '@xata.io/api';
import { determineAgent } from '@vercel/detect-agent';
import * as ciInfo from 'ci-info';

import { config, updateConfig } from './config';
import { getProfile } from './profile';
import type { ApiEnvironment, CustomConfig } from './schemas';

export async function getApi({
  canonicalName,
  cliInvocationId
}: {
  canonicalName?: string;
  cliInvocationId?: string;
} = {}): Promise<XataApi> {
  const agent = await determineAgent();
  const xataAgent: Record<string, string | undefined> = {
    service: 'cli',
    cli_command_id: canonicalName,
    cli_invocation_id: cliInvocationId,
    ci: ciInfo.isCI ? (ciInfo.id?.toLowerCase() ?? 'unknown') : undefined,
    pr: ciInfo.isCI ? (ciInfo.isPR ? 'true' : 'false') : undefined,
    ai_agent: agent.isAgent ? agent.agent.name : undefined
  };

  try {
    const profile = getProfile({});
    const options = getApiOptions(profile);

    return new XataApi({ ...options, xataAgent });
  } catch (e) {
    console.error(e);
    return new XataApi({ baseUrl: '', token: null, xataAgent });
  }
}

// We should inject the environment secrets during the build process
export function getAuthClient(environment: ApiEnvironment, customConfig?: CustomConfig) {
  switch (environment) {
    case 'local':
      return {
        issuer: 'http://localhost:8080/realms/xata',
        clientId: 'cli',
        clientSecret: 'devsecret'
      };
    case 'dev':
      return {
        issuer: 'https://auth.dev.maki.cooking/realms/xata',
        clientId: 'cli',
        clientSecret: 'ToRZxFRan0OrcSS9lXrQg1At6bALSfiM'
      };
    case 'staging':
      return {
        issuer: 'https://auth.staging.maki.cooking/realms/xata',
        clientId: 'cli',
        clientSecret: 'quo8te7gath4PeMieYaithah1laCaing'
      };
    case 'prod':
      return {
        issuer: 'https://auth.xata.io/realms/xata',
        clientId: 'cli',
        clientSecret: 'OhcooQuoNieghie4iege0zetoa3fah4j'
      };
    case 'custom': {
      if (!customConfig) throw new Error('customConfig is required for custom environment');
      return {
        issuer: customConfig.issuer,
        clientId: customConfig.clientId,
        clientSecret: customConfig.clientSecret
      };
    }
    default:
      throw new Error(`Unsupported environment: ${environment}`);
  }
}

export function getApiBaseUrl(environment: ApiEnvironment, customConfig?: CustomConfig) {
  switch (environment) {
    case 'local':
      return 'http://localhost:5001';
    case 'dev':
      return 'https://api.dev.maki.cooking';
    case 'staging':
      return 'https://api.staging.maki.cooking';
    case 'prod':
      return 'https://api.xata.tech';
    case 'custom': {
      if (!customConfig) throw new Error('Custom config is required for custom environment');
      return customConfig.apiBaseUrl;
    }
    default:
      throw new Error(`Unsupported environment: ${environment}`);
  }
}

function getApiOptions(profile: string): ApiOptions {
  // Not logged in, return a dummy client that will fail on any API request
  if (!config?.profiles?.[profile]) {
    return new XataApi({ baseUrl: '', token: null });
  }

  const profileData = config.profiles[profile];
  if (!profileData) {
    throw new Error(`Profile "${profile}" does not exist`);
  }

  const baseUrl = getApiBaseUrl(profileData.environment, profileData.customConfig);

  if (profileData.type === 'apiKey') {
    return { baseUrl, token: profileData.apiKey };
  }

  if (profileData.type === 'oidc') {
    const client = getAuthClient(profileData.environment, profileData.customConfig);

    return {
      baseUrl,
      token: {
        type: 'oidc',
        client,
        accessToken: profileData.accessToken,
        refreshToken: profileData.refreshToken,
        expiresAt: profileData.expiresAt
      },
      callbacks: {
        onTokenRefresh: async (newToken) => {
          await updateConfig({
            ...config,
            profiles: {
              ...config.profiles,
              [profile]: {
                ...profileData,
                accessToken: newToken.accessToken,
                refreshToken: newToken.refreshToken,
                expiresAt: newToken.expiresAt
              }
            }
          });
        }
      }
    };
  }

  throw new Error('Unsupported profile type');
}
