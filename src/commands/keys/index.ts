import { buildRouteMap } from '@stricli/core';
import { KeysOrganizationRoute } from './organization';
import { KeysUserRoute } from './user';

export const KeysRoute = buildRouteMap({
  docs: {
    brief: 'Manage API keys'
  },
  routes: {
    user: KeysUserRoute,
    organization: KeysOrganizationRoute
  },
  aliases: {
    org: 'organization'
  }
});
