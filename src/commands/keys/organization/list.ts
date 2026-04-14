import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';

type Flags = {
  organization?: string;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});
  const { keys } = await this.api.apiKeys.listOrganizationAPIKeys({ pathParams: { organizationID: organizationId } });

  this.print(
    this,
    flags.json,
    keys,
    ['ID', 'Created At', 'Expiry', 'Last Used', 'Name'],
    keys.map((k) => [k.id, k.created_at, k.expiry ?? 'Never', k.last_used ?? 'Never', k.name])
  );
}

export const OrgKeysListCommand = buildCommand({
  docs: {
    brief: 'List all API keys for an organization'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
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
