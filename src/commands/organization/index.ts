import { buildRouteMap } from '@stricli/core';
import { OrganizationCreateCommand } from './create';
import { OrganizationDeleteCommand } from './delete';
import { OrganizationDescribeCommand } from './describe';
import { OrganizationGetCommand } from './get';
import { OrganizationInvitationsRoute } from './invitations';
import { OrganizationListCommand } from './list';
import { OrganizationMembersRoute } from './members';

export const OrganizationRoute = buildRouteMap({
  docs: {
    brief: 'Create, list, and manage organizations',
    fullDescription:
      'An organization owns projects and their billing, and the people who can reach them. Members belong to it, invitations bring them in.'
  },
  routes: {
    list: OrganizationListCommand,
    describe: OrganizationDescribeCommand,
    create: OrganizationCreateCommand,
    delete: OrganizationDeleteCommand,
    get: OrganizationGetCommand,
    members: OrganizationMembersRoute,
    invitations: OrganizationInvitationsRoute
  },
  aliases: {
    ls: 'list',
    view: 'describe',
    show: 'describe'
  }
});
