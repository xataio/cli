import { buildCommand } from '@stricli/core';
import type { Types } from '@xata.io/api';
import chalk from 'chalk';
import treeify, { type TreeObject } from 'treeify';
import type { LocalContext } from '~/context';
import { printCustom, writeNoBranchesInProject } from '~/lib/cli-utils';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  'show-id': boolean;
};

type BranchNode = Types.BranchListMetadata & {
  current: boolean;
  children: BranchNode[];
};

function buildBranchTree(branches: Types.BranchListMetadata[], currentBranch?: Types.BranchListMetadata): BranchNode[] {
  const branchMap: Record<string, BranchNode> = {};
  const rootBranches: BranchNode[] = [];

  branches.forEach((branch) => {
    branchMap[branch.id] = { ...branch, current: currentBranch?.id === branch.id, children: [] };
  });

  branches.forEach((branch) => {
    const branchNode = branchMap[branch.id];
    if (!branchNode) {
      throw new Error(`invariant: branch node not found for branch ${branch.id}`);
    }
    // A branch whose parent is not listed, such as one forked from a deleted branch, is a root here.
    const parentNode = branch.parentID ? branchMap[branch.parentID] : undefined;
    if (parentNode) {
      parentNode.children.push(branchNode);
    } else {
      rootBranches.push(branchNode);
    }
  });

  return rootBranches;
}

function getBranchName(branch: BranchNode, showId: boolean): string {
  const current = branch.current ? ' (current)' : '';
  if (showId) {
    return `${branch.name} (id: ${branch.id})${current}`;
  }
  return `${branch.name}${current}`;
}

function toTreeifyChildren(branch: BranchNode, showId: boolean): TreeObject {
  return branch.children.reduce((acc, child) => {
    acc[getBranchName(child, showId)] = toTreeifyChildren(child, showId);
    return acc;
  }, {} as TreeObject);
}

function toTreeifyFormat(rootBranches: BranchNode[], showId: boolean): TreeObject {
  return rootBranches.reduce((acc, rootBranch) => {
    acc[chalk.bold(getBranchName(rootBranch, showId))] = toTreeifyChildren(rootBranch, showId);
    return acc;
  }, {} as TreeObject);
}

export async function implementation(this: LocalContext, flags: Flags) {
  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const branchId = await this.getBranch(this, flags, { organizationId, projectId, skipPrompt: true });

  const { branches } = await this.api.branches.listBranches({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });

  if (branches.length === 0) {
    writeNoBranchesInProject(this);
    return;
  }

  const currentBranch = branches.find((branch) => branch.id === branchId);

  const rootBranches = buildBranchTree(branches, currentBranch);

  printCustom(this, rootBranches, () => {
    this.process.stdout.write(treeify.asTree(toTreeifyFormat(rootBranches, flags['show-id']), true, false));
  });
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
        brief: 'Branch ID or name',
        parse: String,
        optional: true
      },
      'show-id': {
        kind: 'boolean',
        brief: 'Show branch IDs in the tree',
        default: false
      }
    }
  },
  func: implementation
});
