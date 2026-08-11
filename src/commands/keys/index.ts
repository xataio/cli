import { buildRouteMap } from '@stricli/core';
import { KeysOrganizationRoute } from './organization';
import { KeysUserRoute } from './user';

export const KeysRoute = buildRouteMap({
  docs: {
    brief: 'Create, list, and delete API keys',
    fullDescription:
      'User keys act as the account that created them, organization keys are scoped to one organization and outlive their author, which is what automation should use.'
  },
  routes: {
    user: KeysUserRoute,
    organization: KeysOrganizationRoute
  },
  aliases: {
    org: 'organization'
  }
});
