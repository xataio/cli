import { buildRouteMap } from '@stricli/core';
import { KeysOrganizationRoute } from './organization';
import { KeysUserRoute } from './user';

export const KeysRoute = buildRouteMap({
  docs: {
    brief: 'Create, list, and delete API keys',
    fullDescription:
      'A user key belongs to the account that created it, an organization key to an organization. Both are printed once, when they are created.'
  },
  routes: {
    user: KeysUserRoute,
    organization: KeysOrganizationRoute
  },
  aliases: {
    org: 'organization'
  }
});
