import { branchLimitsFrom, type BranchLimits, replicaCountOptions } from '@xata.io/utils';
import type { LocalContext } from '~/context';

// Effective instance/replica/storage limits for the org. Falls back to today's defaults
// if the limits endpoint is unavailable, so commands never fail on limits alone.
export async function getBranchLimits(context: LocalContext, organizationId: string): Promise<BranchLimits> {
  try {
    const limits = await context.api.projects.getOrganizationLimits({
      pathParams: { organizationID: organizationId }
    });
    return branchLimitsFrom(limits);
  } catch {
    return branchLimitsFrom();
  }
}

export function replicaChoicesFor(maxReplicas: number) {
  return replicaCountOptions(maxReplicas).map((count) => ({
    name: String(count),
    message: String(count)
  }));
}
