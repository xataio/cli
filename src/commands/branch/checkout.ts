import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { updateBranchConfig } from '~/lib/branch-config';
import { updateProjectConfig } from '~/lib/project-config';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  database?: string;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, {
    organizationId
  });
  let currentBranchId = null;
  try {
    currentBranchId = await this.getCheckedOutBranch(this);
  } catch (e) {
    if (e instanceof Error) {
      this.process.stderr.write(`${e.message}\n`);
    }
  }

  const targetBranchId = await this.getBranch(this, flags, {
    organizationId,
    projectId,
    skipProjectConfig: true,
    title: 'Select a branch',
    branchName
  });

  if (targetBranchId === currentBranchId) {
    this.process.stdout.write(`Already on branch ${branchName}\n`);
    this.process.exit(0);
  }

  const targetBranch = await this.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: targetBranchId }
  });

  const database = await this.getDatabase(this, flags);
  await updateProjectConfig({ organizationId, projectId });
  await updateBranchConfig({ branchId: targetBranch.id, branchName: targetBranch.name, databaseName: database });

  const { id, name } = targetBranch;
  this.print(this, flags.json, { id, name }, ['branch'], [[targetBranch.name]]);
}

export const BranchCheckoutCommand = buildCommand({
  docs: {
    brief: 'Check out a branch in this folder',
    fullDescription:
      'Writes the branch to `.xata/` in this folder, so later commands run against it without being told which branch to use.',
    customUsage: [
      { input: 'main', brief: 'Check out a branch of the current project' },
      {
        input: 'feature-branch --organization org-123 --project proj-456',
        brief: 'Check out a branch of another project'
      }
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
      database: {
        kind: 'parsed',
        brief: 'Database name',
        parse: String,
        optional: true
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
          brief: 'The branch to switch to',
          parse: String,
          placeholder: 'branch',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
