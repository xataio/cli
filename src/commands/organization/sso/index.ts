import { buildRouteMap } from '@stricli/core';
import { OrganizationSsoDomainsRoute } from './domains';
import { OrganizationSsoProvidersRoute } from './providers';
import { OrganizationSsoShowCommand } from './show';

export const OrganizationSsoRoute = buildRouteMap({
  docs: {
    brief: 'Configure single sign-on for an organization',
    fullDescription:
      'Claim an email domain, prove you own it with a DNS record, connect the identity provider its members sign in through, and then require it. Each verified domain has its own provider, so an organization can have several.'
  },
  routes: {
    show: OrganizationSsoShowCommand,
    domains: OrganizationSsoDomainsRoute,
    providers: OrganizationSsoProvidersRoute
  },
  aliases: {
    get: 'show'
  }
});
