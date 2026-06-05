import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';

type Flags = {
  organization?: string;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});

  const { members } = await this.api.organizations.listOrganizationMembers({
    pathParams: { organizationID: organizationId! }
  });

  this.print(
    this,
    flags.json,
    members,
    ['member_id', 'email', 'name'],
    members.map((member) => [member.id, member.email, member.name || '-'])
  );
}

export const OrganizationMembersListCommand = buildCommand({
  docs: {
    brief: 'List all members of an organization'
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
