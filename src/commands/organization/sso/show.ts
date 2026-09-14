import { buildCommand } from '@stricli/core';
import { ApiError } from '@xata.io/api';
import { ssoRedirectUri } from '@xata.io/utils';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { exitWithError, printCustom } from '~/lib/cli-utils';
import { renderTable } from '~/lib/table';

type Flags = {
  organization?: string;
};

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationID = await this.getOrganization(this, flags, {});
  const sso = await this.api.organizations
    .getOrganizationSSO({ pathParams: { organizationID } })
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) {
        return exitWithError(this, 'Single sign-on is not available for this organization.');
      }
      throw error;
    });

  printCustom(this, sso, () => {
    if (sso.domains.length === 0) {
      this.process.stdout.write(
        `No domains claimed for this organization. Start with ${chalk.bold.italic('xata organization sso domains add <domain>')}.\n`
      );
      return;
    }

    const domainRows = sso.domains.map((domain) => [
      domain.domain,
      domain.verified ? 'yes' : 'no',
      domain.verification?.record_value ?? '-',
      ssoRedirectUri(this.apiIssuer, domain.provider_alias)
    ]);
    this.process.stdout.write(
      `${chalk.bold('Domains')}\n${renderTable(['domain', 'verified', 'txt_value', 'redirect_uri'], domainRows)}\n`
    );

    if (sso.providers.length === 0) {
      this.process.stdout.write(
        `\nNo identity providers yet. Connect one to a verified domain with ${chalk.bold.italic('xata organization sso providers add')}.\n`
      );
      return;
    }

    const providerRows = sso.providers.map((provider) => [
      provider.alias,
      provider.type,
      provider.domain,
      provider.enforced ? 'yes' : 'no',
      provider.issuer ?? '-'
    ]);
    this.process.stdout.write(
      `\n${chalk.bold('Identity providers')}\n${renderTable(['alias', 'type', 'domain', 'enforced', 'issuer'], providerRows)}\n`
    );
  });
}

export const OrganizationSsoShowCommand = buildCommand({
  docs: {
    brief: 'Show the domains and identity providers configured for an organization'
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
