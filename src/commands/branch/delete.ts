import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';

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
  const currentBranchId = await this.getCheckedOutBranch(this);
  const branchToDeleteId = await this.getBranch(this, flags, { organizationId, projectId, branchName });

  if (branchToDeleteId === currentBranchId) {
    this.process.stderr.write(chalk.red(`Cannot delete the current checked out branch\n`));
    this.process.exit(1);
  }

  const branchToDelete = await this.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchToDeleteId }
  });

  if (!branchToDelete) {
    this.process.stderr.write(chalk.red(`Branch not found`));
    this.process.exit(1);
  }

  if (!flags.yes) {
    if (!this.isInteractive) {
      // In an interactive terminal, declining the confirmation is an intentional
      // user cancellation, so it exits successfully below. In CI or agentic
      // contexts prompts are disabled, so there is no opportunity to confirm;
      // returning success would make automation think the branch was deleted.
      this.process.stderr.write(chalk.red(`Cannot delete branch without confirmation. Pass --yes to confirm.\n`));
      this.process.exit(1);
    }

    const confirmFromPrompt = await this.enquirer.confirmPrompt(
      this.isInteractive,
      `Are you sure you want to delete the branch ${branchToDelete.name} with id ${branchToDelete.id}?`
    );
    if (!confirmFromPrompt) {
      this.process.stdout.write(`Aborted as there was no confirmation. Branch ${branchToDelete.id} not deleted`);
      return;
    }
  }

  await this.api.branches.deleteBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchToDelete.id }
  });

  this.print(this, flags.json, branchToDelete, ['branch'], [[branchToDelete.name]]);
}

export const BranchDeleteCommand = buildCommand({
  docs: {
    brief: 'Delete a branch'
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
          brief: 'The branch to delete',
          parse: String,
          placeholder: 'branch name',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
