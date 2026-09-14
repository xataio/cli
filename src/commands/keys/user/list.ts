import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';

export async function implementation(this: LocalContext) {
  const { keys } = await this.api.apiKeys.listUserAPIKeys({});

  this.printTable(
    this,
    keys,
    ['key_id', 'created_at', 'expiry', 'last_used', 'name'],
    keys.map((k) => [k.id, k.created_at, k.expiry ?? 'Never', k.last_used ?? 'Never', k.name])
  );
}

export const UserKeysListCommand = buildCommand({
  docs: {
    brief: 'List all API keys of the current user'
  },
  parameters: {
    flags: {}
  },
  func: implementation
});
