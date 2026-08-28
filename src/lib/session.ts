import { SessionExpiredError } from '@xata.io/api';
import { decodeJwt } from 'jose';
import { getProfileApi } from './api';
import type { AuthProfile } from './schemas';

// The stored `expiresAt` is the access token's, which lives minutes. The offline
// refresh token carries the session's own expiry, so read it from there instead.
export function getSessionExpiry(profileData?: AuthProfile): Date | undefined {
  if (profileData?.type !== 'oidc') {
    return undefined;
  }

  try {
    const { exp } = decodeJwt(profileData.refreshToken);
    if (typeof exp !== 'number' || exp <= 0) {
      return undefined;
    }

    return new Date(exp * 1000);
  } catch {
    return undefined;
  }
}

export async function isSessionValid(profile: string, profileData?: AuthProfile) {
  if (profileData?.type !== 'oidc') {
    return true;
  }

  try {
    await getProfileApi(profile).refreshToken();
    return true;
  } catch (error) {
    // Only a rejected refresh grant proves the session is gone, network failures don't.
    return !(error instanceof SessionExpiredError);
  }
}
