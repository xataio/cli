import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { parseExpiry } from '~/lib/api-key-utils';

interface Flags {
  organization?: string;
  name?: string;
  expiry?: string;
  json: boolean;
}

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});

  const name = await this.enquirer.inputPrompt(this.isInteractive, 'API key name', { flag: flags.name });
  const expiry = await parseExpiry(this.isInteractive, flags.expiry);

  const { key } = await this.api.apiKeys.createOrganizationAPIKey({
    pathParams: { organizationID: organizationId },
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

export const OrgKeysCreateCommand = buildCommand({
  docs: {
    brief: 'Create a new API key'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
      },
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
