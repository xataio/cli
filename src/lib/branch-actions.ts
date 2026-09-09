import type { Types } from '@xata.io/api';
import type { LocalContext } from '~/context';

export type RootBranchOptions = {
  organizationId: string;
  projectId: string;
  name: string;
  description?: string;
  replicas: number;
  region: string;
  instanceType: string;
  scaleToZero: boolean;
  inactivityPeriodMinutes: number;
  image: string;
};

export type ChildBranchOptions = {
  organizationId: string;
  projectId: string;
  parentBranch: string;
  name: string;
  description?: string;
  scaleToZero: boolean;
  inactivityPeriodMinutes: number;
};

export async function createRootBranch(context: LocalContext, options: RootBranchOptions) {
  const configuration: Types.ClusterConfiguration = {
    replicas: options.replicas,
    image: options.image,
    region: options.region,
    instanceType: options.instanceType
  };
  const branch = await context.api.branches.createBranch({
    pathParams: { organizationID: options.organizationId, projectID: options.projectId },
    body: {
      name: options.name,
      description: options.description,
      mode: 'custom',
      configuration,
      scaleToZero: {
        enabled: options.scaleToZero,
        inactivityPeriodMinutes: options.inactivityPeriodMinutes
      }
    }
  });
  return branch;
}

export async function createChildBranch(context: LocalContext, options: ChildBranchOptions) {
  const branch = await context.api.branches.createBranch({
    pathParams: { organizationID: options.organizationId, projectID: options.projectId },
    body: {
      name: options.name,
      description: options.description,
      mode: 'inherit',
      parentID: options.parentBranch,
      scaleToZero: {
        enabled: options.scaleToZero,
        inactivityPeriodMinutes: options.inactivityPeriodMinutes
      }
    }
  });
  return branch;
}

export async function getChildBranchDefaults(context: LocalContext, organizationId: string, projectId: string) {
  const project = await context.api.projects.getProject({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });
  const { enabled, inactivityPeriodMinutes } = project.configuration.scaleToZero.childBranches;
  return { scaleToZero: enabled, inactivityPeriodMinutes };
}

export async function deleteBranchById(
  context: LocalContext,
  organizationId: string,
  projectId: string,
  branchId: string
) {
  await context.api.branches.deleteBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
  });
}

export function getBranchDeletionBlocker(branchId: string, checkedOutBranchId: string | null): string | null {
  if (checkedOutBranchId && branchId === checkedOutBranchId) {
    return 'Cannot delete the current checked out branch';
  }
  return null;
}
