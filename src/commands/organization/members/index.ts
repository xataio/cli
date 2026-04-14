import { buildRouteMap } from '@stricli/core';
import { OrganizationMembersInviteCommand } from './invite';
import { OrganizationMembersListCommand } from './list';
import { OrganizationMembersRemoveCommand } from './remove';

export const OrganizationMembersRoute = buildRouteMap({
  docs: {
    brief: 'Manage organization members'
  },
  routes: {
    list: OrganizationMembersListCommand,
    invite: OrganizationMembersInviteCommand,
    remove: OrganizationMembersRemoveCommand
  },
  aliases: {
    ls: 'list',
    add: 'invite',
    delete: 'remove',
    rm: 'remove'
  }
});
