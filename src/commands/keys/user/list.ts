import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';

type Flags = {
  json: boolean;
};

export async function implementation(this: LocalContext, { json }: Flags) {
  const { keys } = await this.api.apiKeys.listUserAPIKeys({});

  this.print(
    this,
    json,
    keys,
    ['ID', 'Created At', 'Expiry', 'Last Used', 'Name'],
    keys.map((k) => [k.id, k.created_at, k.expiry ?? 'Never', k.last_used ?? 'Never', k.name])
  );
}

export const UserKeysListCommand = buildCommand({
  docs: {
    brief: 'List all API keys of the current user'
  },
  parameters: {
    flags: {
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      }
    }
  },
  func: implementation
});
