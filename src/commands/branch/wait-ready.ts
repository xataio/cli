import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;

  json: boolean;
  wake?: boolean;
};

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId, branchName });

  let branch = await this.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
  });

  while (branch.status.statusType !== 'STATUS_TYPE_HEALTHY') {
    if (branch.status.statusType === 'STATUS_TYPE_HIBERNATED') {
      if (flags.wake) {
        this.process.stderr.write(chalk.yellow(`Branch ${branch.name} is hibernated. Waking up...\n`));
        await this.api.branches.updateBranch({
          pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId },
          body: {
            hibernate: false
          }
        });
      } else {
        this.process.stderr.write(chalk.yellow(`Branch ${branch.name} is hibernated. Use --wake to wake it up.\n`));
        return;
      }
    }

    this.process.stderr.write(chalk.yellow(`Waiting for branch ${branch.name} to be ready...\n`));

    await new Promise((resolve) => setTimeout(resolve, 1000));

    branch = await this.api.branches.describeBranch({
      pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
    });
  }

  this.print(
    this,
    flags.json,
    branch,
    ['branch_id', 'name', 'status'],
    [[branch.id, branch.name, branch.status.status]]
  );
}

export const BranchWaitReadyCommand = buildCommand({
  docs: {
    brief: 'Wait for a branch to be ready',
    fullDescription:
      'Blocks until the branch is healthy, which is what a script needs after creating one or after a change that restarts it. A hibernated branch stays hibernated unless `--wake` is passed.',
    customUsage: [
      { input: 'my-branch', brief: 'Wait for a branch to come up' },
      { input: 'my-branch --wake', brief: 'Wake a hibernated branch and wait for it' }
    ]
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
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      },
      wake: {
        kind: 'boolean',
        brief: 'Wake up the branch if it is hibernated',
        optional: true
      }
    },
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'The branch to wait for',
          parse: String,
          placeholder: 'branch name',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
