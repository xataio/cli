import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import type { Types } from '@xata.io/api';
import { fetchBranchCredentials } from '@xata.io/sql';
import { getErrorMessage } from '~/lib/cli-utils';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  yes: boolean;
  json: boolean;
};

async function resolveDatabaseUsername(
  context: LocalContext,
  branch: Types.GetBranchCredentialsPathParams
): Promise<string> {
  try {
    const { username } = await fetchBranchCredentials(context.api, branch);
    return username;
  } catch (error) {
    context.process.stderr.write(
      chalk.red(
        `Could not read the credentials for this branch: ${getErrorMessage(error)}\nAPI keys need the ${chalk.bold('credentials:read')} scope; if the branch is still starting, wait for it with ${chalk.bold('xata branch wait-ready')}.\n`
      )
    );
    return context.process.exit(1);
  }
}

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId, branchName });

  const branch = await this.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
  });

  const username = await resolveDatabaseUsername(this, {
    organizationID: organizationId,
    projectID: projectId,
    branchID: branchId
  });

  if (!flags.yes) {
    const confirmed = await this.enquirer.confirmPrompt(
      this.isInteractive,
      `Rotate the password for PostgreSQL user ${username} on branch ${branch.name}? Existing connections will not be affected, but any new connections will need to use the new credentials.`
    );
    if (!confirmed) {
      this.process.stdout.write('Aborted as there was no confirmation. Password not rotated.');
      return;
    }
  }

  await this.api.branches.rotateBranchCredentials({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branch.id },
    body: { username }
  });

  this.print(
    this,
    flags.json,
    { branchId: branch.id, branchName: branch.name, username },
    ['branch', 'username', 'status'],
    [[branch.name, username, 'Password rotated successfully']]
  );
}

export const BranchRotatePasswordCommand = buildCommand({
  docs: {
    brief: 'Rotate the database password for a branch',
    fullDescription:
      'Reads the current username from the credentials endpoint, so an API key needs the `credentials:read` scope.'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
      },
      project: {
        kind: 'parsed',
        brief: 'Project ID',
        parse: String,
        optional: true
      },
      branch: {
        kind: 'parsed',
        brief: 'Branch ID',
        parse: String,
        optional: true
      },
      yes: {
        kind: 'boolean',
        brief: 'Do not ask for confirmation, assume yes.',
        default: false
      },
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      }
    },
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'The branch to rotate the password for',
          parse: String,
          placeholder: 'branch name',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
