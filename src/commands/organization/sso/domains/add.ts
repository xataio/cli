import { buildCommand } from '@stricli/core';
import { ssoDomainSchema, ssoRedirectUri } from '@xata.io/utils';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { exitWithError, printCustom } from '~/lib/cli-utils';
import { renderTable } from '~/lib/table';

type Flags = {
  organization?: string;
};

export async function implementation(this: LocalContext, flags: Flags, domainArg?: string) {
  const organizationID = await this.getOrganization(this, flags, {});
  const input = await this.enquirer.inputPrompt(this.isInteractive, 'Domain to claim', { flag: domainArg });
  const parsed = ssoDomainSchema.safeParse(input);
  if (!parsed.success) {
    return exitWithError(this, parsed.error.issues[0]?.message ?? 'A domain is required.');
  }

  const domain = await this.api.organizations.claimOrganizationSSODomain({
    pathParams: { organizationID },
    body: { domain: parsed.data }
  });

  printCustom(this, domain, () => {
    this.process.stdout.write(chalk.green(`✓ Claimed ${domain.domain}\n\n`));

    if (domain.verification) {
      const { record_type, record_name, record_value } = domain.verification;
      this.process.stdout.write(
        `Publish this DNS record, then verify the domain:\n\n${renderTable(['type', 'name', 'value'], [[record_type, record_name, record_value]])}\n\n`
      );
    }

    this.process.stdout.write(
      `Register this redirect URI with your identity provider:\n\n  ${ssoRedirectUri(this.apiIssuer, domain.provider_alias)}\n\n`
    );
    this.process.stdout.write(`${chalk.bold.italic(`xata organization sso domains verify ${domain.domain}`)}\n`);
  });
}

export const OrganizationSsoDomainsAddCommand = buildCommand({
  docs: {
    brief: 'Claim an email domain and print the DNS record that proves you own it'
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
      kind: 'tuple',
      parameters: [
        {
          brief: 'Domain to claim, such as acme.com',
          parse: String,
          placeholder: 'domain',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
