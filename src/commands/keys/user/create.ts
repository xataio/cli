import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { parseExpiry } from '~/lib/api-key-utils';

interface Flags {
  name?: string;
  expiry?: string;
  json: boolean;
}

export async function implementation(this: LocalContext, flags: Flags) {
  const name = await this.enquirer.inputPrompt(this.isInteractive, 'API key name', { flag: flags.name });
  const expiry = await parseExpiry(this.isInteractive, flags.expiry);

  const { key } = await this.api.apiKeys.createUserAPIKey({
    body: { name, expiry }
  });

  this.print(
    this,
    flags.json,
    key,
    ['key_id', 'created_at', 'expiry', 'name', 'token'],
    [[key.id, key.created_at, key.expiry ?? 'Never', key.name, key.token]]
  );
}

export const UserKeysCreateCommand = buildCommand({
  docs: {
    brief: 'Create a new API key',
    fullDescription:
      'Creates a key for the account you are logged in with. It is printed once, when it is created, and cannot be read again.',
    customUsage: [
      { input: '--name ci', brief: 'Create a key that does not expire' },
      { input: '--name ci --expiry 2026-12-31', brief: 'Create a key that expires' }
    ]
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
        brief: `Expiry, as a date or a phrase such as 'in 1 week', or 'never'`,
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
