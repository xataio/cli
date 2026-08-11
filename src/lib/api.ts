import { type ApiOptions, XataApi } from '@xata.io/api';
import { determineAgent } from '@vercel/detect-agent';
import * as ciInfo from 'ci-info';

import { config, updateConfig } from './config';
import { getProfile } from './profile';
import type { CustomConfig } from './schemas';
import {
  DEFAULT_API_BASE_URL,
  DEFAULT_API_CLIENT_ID,
  DEFAULT_API_CLIENT_SECRET,
  DEFAULT_API_ISSUER
} from './constants';

export type ApiOptionsFromCommand = {
  canonicalName?: string;
  cliInvocationId?: string;
  profile?: string;
};

export async function getApi({
  canonicalName,
  cliInvocationId,
  profile: profileFlag
}: ApiOptionsFromCommand = {}): Promise<XataApi> {
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
    const profile = getProfile({ profileFlag });
    const options = getApiOptions(profile);

    return new XataApi({ ...options, xataAgent });
  } catch (e) {
    console.error(e);
    return new XataApi({ token: null, xataAgent });
  }
}

// We should inject the environment secrets during the build process
export function getAuthConfig(customConfig?: CustomConfig) {
  return {
    baseUrl: customConfig?.apiBaseUrl ?? DEFAULT_API_BASE_URL,
    client: {
      issuer: customConfig?.issuer ?? DEFAULT_API_ISSUER,
      clientId: customConfig?.clientId ?? DEFAULT_API_CLIENT_ID,
      clientSecret: customConfig?.clientSecret ?? DEFAULT_API_CLIENT_SECRET
    }
  };
}

function getApiOptions(profile: string): ApiOptions {
  // Not logged in, return a dummy client that will fail on any API request
  if (!config?.profiles?.[profile]) {
    return { token: null };
  }

  const profileData = config.profiles[profile];
  if (!profileData) {
    throw new Error(`Profile "${profile}" does not exist`);
  }

  const { baseUrl, client } = getAuthConfig(profileData.customConfig);

  if (profileData.type === 'apiKey') {
    return { baseUrl, token: profileData.apiKey };
  }

  if (profileData.type === 'oidc') {
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
