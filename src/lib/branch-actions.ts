import type { Types } from '@xata.io/api';
import type { LocalContext } from '~/context';

export async function createRootBranch(
  context: LocalContext,
  organizationId: string,
  projectId: string,
  branchName: string,
  replicas: number,
  region: string,
  instanceType: string,
  scaleToZero: boolean,
  inactivityPeriodMinutes: number,
  image: string
) {
  const configuration: Types.ClusterConfiguration = {
    replicas,
    image,
    region,
    instanceType
  };
  const branch = await context.api.branches.createBranch({
    pathParams: { organizationID: organizationId, projectID: projectId },
    body: {
      name: branchName,
      mode: 'custom',
      configuration,
      scaleToZero: {
        enabled: scaleToZero,
        inactivityPeriodMinutes
      }
    }
  });
  return branch;
}

export async function createChildBranch(
  context: LocalContext,
  organizationId: string,
  projectId: string,
  parentBranch: string,
  branchName: string,
  scaleToZero: boolean,
  inactivityPeriodMinutes: number
) {
  const branch = await context.api.branches.createBranch({
    pathParams: { organizationID: organizationId, projectID: projectId },
    body: {
      name: branchName,
      mode: 'inherit',
      parentID: parentBranch,
      scaleToZero: {
        enabled: scaleToZero,
        inactivityPeriodMinutes
      }
    }
  });
  return branch;
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
