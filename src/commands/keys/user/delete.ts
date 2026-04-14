import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';

interface Flags {
  json: boolean;
}

export async function implementation(this: LocalContext, flags: Flags, ...ids: string[]) {
  await this.api.apiKeys.deleteUserAPIKeys({ body: { ids } });

  this.print(
    this,
    flags.json,
    { deleted: ids.length },
    ['Deleted keys'],
    ids.map((id) => [id])
  );
}

export const UserKeysDeleteCommand = buildCommand({
  docs: {
    brief: 'Delete one or more API keys'
  },
  parameters: {
    flags: {
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      }
    },
    positional: {
      kind: 'array',
      parameter: {
        brief: 'IDs of the keys to delete',
        parse: String,
        placeholder: 'keyId'
      }
    }
  },
  func: implementation
});
