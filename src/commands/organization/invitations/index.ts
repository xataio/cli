import { buildRouteMap } from '@stricli/core';
import { OrganizationInvitationsCreateCommand } from './create';
import { OrganizationInvitationsDeleteCommand } from './delete';
import { OrganizationInvitationsGetCommand } from './get';
import { OrganizationInvitationsListCommand } from './list';
import { OrganizationInvitationsResendCommand } from './resend';

export const OrganizationInvitationsRoute = buildRouteMap({
  docs: {
    brief: 'Manage organization invitations'
  },
  routes: {
    list: OrganizationInvitationsListCommand,
    get: OrganizationInvitationsGetCommand,
    create: OrganizationInvitationsCreateCommand,
    delete: OrganizationInvitationsDeleteCommand,
    resend: OrganizationInvitationsResendCommand
  },
  aliases: {
    ls: 'list',
    show: 'get',
    add: 'create',
    invite: 'create',
    rm: 'delete',
    remove: 'delete'
  }
});
