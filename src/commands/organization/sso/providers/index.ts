import { buildRouteMap } from '@stricli/core';
import { OrganizationSsoProvidersAddCommand } from './add';
import { OrganizationSsoProvidersEnforceCommand } from './enforce';
import { OrganizationSsoProvidersRemoveCommand } from './remove';

export const OrganizationSsoProvidersRoute = buildRouteMap({
  docs: {
    brief: 'Connect the identity providers that sign in each verified domain'
  },
  routes: {
    add: OrganizationSsoProvidersAddCommand,
    remove: OrganizationSsoProvidersRemoveCommand,
    enforce: OrganizationSsoProvidersEnforceCommand
  },
  aliases: {
    connect: 'add',
    delete: 'remove'
  }
});
