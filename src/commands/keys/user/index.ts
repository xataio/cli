import { buildRouteMap } from '@stricli/core';
import { UserKeysCreateCommand } from './create';
import { UserKeysDeleteCommand } from './delete';
import { UserKeysListCommand } from './list';

export const KeysUserRoute = buildRouteMap({
  docs: {
    brief: 'Manage API keys for the current user'
  },
  routes: {
    list: UserKeysListCommand,
    create: UserKeysCreateCommand,
    delete: UserKeysDeleteCommand
  },
  aliases: {
    ls: 'list'
  }
});
