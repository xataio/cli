import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import invariant from 'tiny-invariant';
import type { LocalContext } from '~/context';
import { parseConnectionString } from '@xata.io/sql';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  yes: boolean;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId, branchName });

  const branch = await this.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
  });

  if (!branch.connectionString) {
    this.process.stderr.write(
      chalk.red(
        `This branch does not currently expose a connection string. Wait until it is ready with ${chalk.bold('xata branch wait-ready')} and try again.\n`
      )
    );
    this.process.exit(1);
  }

  const { username } = parseConnectionString(branch.connectionString);
  invariant(username, 'Could not derive the PostgreSQL username from the branch connection string.');

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
    ['Branch', 'Username', 'Status'],
    [[branch.name, username, 'Password rotated successfully']]
  );
}

export const BranchRotatePasswordCommand = buildCommand({
  docs: {
    brief: 'Rotate the database password for a branch'
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
