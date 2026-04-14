import { buildRouteMap } from '@stricli/core';
import { OrgKeysCreateCommand } from './create';
import { OrgKeysDeleteCommand } from './delete';
import { OrgKeysListCommand } from './list';

export const KeysOrganizationRoute = buildRouteMap({
  docs: {
    brief: 'Manage API keys for an organization'
  },
  routes: {
    list: OrgKeysListCommand,
    create: OrgKeysCreateCommand,
    delete: OrgKeysDeleteCommand
  },
  aliases: {
    ls: 'list'
  }
});
