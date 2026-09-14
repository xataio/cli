import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { exitWithError, printCustom } from '~/lib/cli-utils';

type Flags = {
  organization?: string;
};

export async function implementation(this: LocalContext, flags: Flags, domainArg?: string) {
  const organizationID = await this.getOrganization(this, flags, {});
  const domainName = await this.enquirer.inputPrompt(this.isInteractive, 'Domain to verify', { flag: domainArg });
  if (!domainName) {
    return exitWithError(this, 'A domain is required.');
  }

  const domain = await this.api.organizations.verifyOrganizationSSODomain({
    pathParams: { organizationID, domain: domainName }
  });

  printCustom(this, domain, () => {
    this.process.stdout.write(
      domain.verified
        ? chalk.green(`✓ ${domain.domain} verified\n`)
        : chalk.yellow(
            `${domain.domain} is still pending. No TXT record found at ${domain.verification?.record_name ?? domain.domain} yet; DNS changes can take a while to spread.\n`
          )
    );
  });

  if (!domain.verified) {
    this.process.exit(1);
  }
}

export const OrganizationSsoDomainsVerifyCommand = buildCommand({
  docs: {
    brief: 'Check the DNS record for a claimed domain and mark it verified'
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
          brief: 'Domain to verify, such as acme.com',
          parse: String,
          placeholder: 'domain',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
