import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';

type Flags = {
  organization?: string;
  status?: 'pending' | 'expired';
  email?: string;
  search?: string;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});

  const queryParams: {
    status?: 'pending' | 'expired';
    email?: string;
    search?: string;
  } = {};

  if (flags.status) queryParams.status = flags.status;
  if (flags.email) queryParams.email = flags.email;
  if (flags.search) queryParams.search = flags.search;

  const { invitations } = await this.api.organizations.listOrganizationInvitations({
    pathParams: { organizationID: organizationId! },
    queryParams
  });

  this.print(
    this,
    flags.json,
    invitations,
    ['ID', 'Email', 'Name', 'Status', 'Expires'],
    invitations.map((inv) => [
      inv.id,
      inv.email,
      [inv.first_name, inv.last_name].filter(Boolean).join(' ') || '-',
      inv.status,
      new Date(inv.expires_at).toISOString()
    ])
  );
}

export const OrganizationInvitationsListCommand = buildCommand({
  docs: {
    brief: 'List all invitations for an organization'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
      },
      status: {
        kind: 'parsed',
        brief: 'Filter by invitation status (pending or expired)',
        parse: (value) => {
          if (value !== 'pending' && value !== 'expired') {
            throw new Error('Status must be either "pending" or "expired"');
          }
          return value;
        },
        optional: true
      },
      email: {
        kind: 'parsed',
        brief: 'Filter by email address',
        parse: String,
        optional: true
      },
      search: {
        kind: 'parsed',
        brief: 'Search invitations by email or name',
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
