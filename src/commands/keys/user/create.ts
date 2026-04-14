import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { parseExpiry } from '~/lib/api-key-utils';

interface Flags {
  name?: string;
  expiry?: string;
  json: boolean;
}

export async function implementation(this: LocalContext, flags: Flags) {
  const name = await this.enquirer.inputPrompt(this.isCI, 'API key name', { flag: flags.name });
  const expiry = await parseExpiry(this.isCI, flags.expiry);

  const { key } = await this.api.apiKeys.createUserAPIKey({
    body: { name, expiry }
  });

  this.print(
    this,
    flags.json,
    key,
    ['ID', 'Created At', 'Expiry', 'Name', 'Token'],
    [[key.id, key.created_at, key.expiry ?? 'Never', key.name, key.token]]
  );
}

export const UserKeysCreateCommand = buildCommand({
  docs: {
    brief: 'Create a new API key'
  },
  parameters: {
    flags: {
      name: {
        kind: 'parsed',
        brief: 'API key name',
        parse: String,
        optional: true
      },
      expiry: {
        kind: 'parsed',
        brief: 'Expiration date (ISO format) or empty for no expiry',
        parse: String,
        optional: true
      },
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      }
    }
  },
  func: implementation
});
