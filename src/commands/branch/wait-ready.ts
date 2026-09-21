import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  wake?: boolean;
};

type WaitOptions = {
  organizationId: string;
  projectId: string;
  branchId: string;
  wake?: boolean;
};

/** Returns the branch once it is healthy, reporting progress on stderr. */
export async function waitForBranchReady(
  context: LocalContext,
  { organizationId, projectId, branchId, wake }: WaitOptions
) {
  let branch = await context.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
  });

  while (branch.status.statusType !== 'STATUS_TYPE_HEALTHY') {
    if (branch.status.statusType === 'STATUS_TYPE_HIBERNATED') {
      if (!wake) {
        context.process.stderr.write(chalk.yellow(`Branch ${branch.name} is hibernated. Use --wake to wake it up.\n`));
        return undefined;
      }

      context.process.stderr.write(chalk.yellow(`Branch ${branch.name} is hibernated. Waking up...\n`));
      await context.api.branches.updateBranch({
        pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId },
        body: { hibernate: false }
      });
    }

    context.process.stderr.write(chalk.yellow(`Waiting for branch ${branch.name} to be ready...\n`));

    await new Promise((resolve) => setTimeout(resolve, 1000));

    branch = await context.api.branches.describeBranch({
      pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
    });
  }

  return branch;
}

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId, branchName });

  const branch = await waitForBranchReady(this, { organizationId, projectId, branchId, wake: flags.wake });
  if (!branch) {
    return;
  }

  this.printDetails(this, branch, [
    ['branch_id', branch.id],
    ['name', branch.name],
    ['status', branch.status.status]
  ]);
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
        brief: 'Branch ID or name',
        parse: String,
        optional: true
      },
      wake: {
        kind: 'boolean',
        brief: 'Wake up the branch if it is hibernated',
        optional: true,
        withNegated: false
      }
    },
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'The branch to wait for',
          parse: String,
          placeholder: 'branch',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
