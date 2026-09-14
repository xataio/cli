import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';

type Flags = {
  organization?: string;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});
  const { keys } = await this.api.apiKeys.listOrganizationAPIKeys({ pathParams: { organizationID: organizationId } });

  this.printTable(
    this,
    keys,
    ['key_id', 'created_at', 'expiry', 'last_used', 'name'],
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
      }
    }
  },
  func: implementation
});
