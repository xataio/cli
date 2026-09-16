import { buildRouteMap } from '@stricli/core';
import { OrganizationMembersInviteCommand } from './invite';
import { OrganizationMembersListCommand } from './list';
import { OrganizationMembersRemoveCommand } from './remove';
import { OrganizationMembersSetRoleCommand } from './set-role';

export const OrganizationMembersRoute = buildRouteMap({
  docs: {
    brief: 'Manage organization members'
  },
  routes: {
    list: OrganizationMembersListCommand,
    invite: OrganizationMembersInviteCommand,
    remove: OrganizationMembersRemoveCommand,
    'set-role': OrganizationMembersSetRoleCommand
  },
  aliases: {
    ls: 'list',
    add: 'invite',
    delete: 'remove',
    rm: 'remove'
  }
});
