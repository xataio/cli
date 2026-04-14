import { buildCommand } from '@stricli/core';
import type { Types } from '@xata.io/api';
import chalk from 'chalk';
import treeify from 'treeify';
import type { LocalContext } from '~/context';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  'show-id': boolean;
};

type BranchNode = Types.BranchListMetadata & {
  children: BranchNode[];
};

function buildBranchTree(
  branches: Types.BranchListMetadata[],
  showId: boolean,
  currentBranch?: Types.BranchListMetadata
): Record<string, any> {
  const branchMap: Record<string, BranchNode> = {};
  const rootBranches: BranchNode[] = [];

  branches.forEach((branch) => {
    branchMap[branch.id] = { ...branch, children: [] };
  });

  branches.forEach((branch) => {
    if (branch.parentID) {
      const branchNode = branchMap[branch.id];
      if (!branchNode) {
        throw new Error(`invariant: branch node not found for branch ${branch.id}`);
      }
      branchMap[branch.parentID]?.children.push(branchNode);
    } else {
      const branchNode = branchMap[branch.id];
      if (!branchNode) {
        throw new Error(`invariant: branch node not found for branch ${branch.id}`);
      }
      rootBranches.push(branchNode);
    }
  });

  function getBranchName(branch: BranchNode, showId: boolean, currentBranch?: Types.BranchListMetadata): string {
    const current = currentBranch?.id === branch.id ? ' (current)' : '';
    if (showId) {
      return `${branch.name} (id: ${branch.id})${current}`;
    }
    return `${branch.name}${current}`;
  }

  function convertToTreeifyFormat(branch: BranchNode): Record<string, unknown> {
    const children = branch.children.reduce(
      (acc, child) => {
        acc[getBranchName(child, showId, currentBranch)] = convertToTreeifyFormat(child);
        return acc;
      },
      {} as Record<string, unknown>
    );

    return children;
  }
  const tree = rootBranches.reduce(
    (acc, rootBranch) => {
      const rootBranchName = chalk.bold(getBranchName(rootBranch, showId, currentBranch));
      acc[rootBranchName] = convertToTreeifyFormat(rootBranch);
      return acc;
    },
    {} as Record<string, unknown>
  );

  return tree;
}

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId, skipPrompt: true });

  const { branches } = await this.api.branches.listBranches({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });

  const currentBranch = branches.find((branch) => branch.id === branchId);

  const tree = buildBranchTree(branches, flags['show-id'], currentBranch);
  this.process.stdout.write(treeify.asTree(tree, true, false));
}

export const BranchTreeCommand = buildCommand({
  docs: {
    brief: 'List all branches as a tree'
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
      'show-id': {
        kind: 'boolean',
        brief: 'Project ID',
        default: false
      }
    }
  },
  func: implementation
});
