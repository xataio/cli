import { buildRouteMap } from '@stricli/core';
import { OrganizationSsoDomainsAddCommand } from './add';
import { OrganizationSsoDomainsRemoveCommand } from './remove';
import { OrganizationSsoDomainsVerifyCommand } from './verify';

export const OrganizationSsoDomainsRoute = buildRouteMap({
  docs: {
    brief: 'Claim and verify the email domains that sign in through your identity providers'
  },
  routes: {
    add: OrganizationSsoDomainsAddCommand,
    verify: OrganizationSsoDomainsVerifyCommand,
    remove: OrganizationSsoDomainsRemoveCommand
  },
  aliases: {
    claim: 'add',
    delete: 'remove'
  }
});
