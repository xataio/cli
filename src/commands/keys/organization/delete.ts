import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';

interface Flags {
  organization?: string;
}

export async function implementation(this: LocalContext, flags: Flags, ...ids: string[]) {
  const organizationId = await this.getOrganization(this, flags, {});

  await this.api.apiKeys.deleteOrganizationAPIKeys({ pathParams: { organizationID: organizationId }, body: { ids } });

  this.printTable(
    this,
    { deleted: ids.length },
    ['deleted_key_id'],
    ids.map((id) => [id])
  );
}

export const OrgKeysDeleteCommand = buildCommand({
  docs: {
    brief: 'Delete one or more API keys'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
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
