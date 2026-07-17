import type { LocalContext } from '~/context';

const DEFAULT_MAX_INSTANCES_PER_BRANCH = 5;

export type BranchLimits = { maxReplicas: number; maxAllowedVCPUs: number | undefined };

// Effective instance/replica limits for the org. Falls back to today's defaults
// (4 replicas, no instance-type cap) if the limits endpoint is unavailable, so
// commands never fail on limits alone.
export async function getBranchLimits(context: LocalContext, organizationId: string): Promise<BranchLimits> {
  try {
    const limits = await context.api.projects.getOrganizationLimits({
      pathParams: { organizationID: organizationId }
    });
    return {
      maxReplicas: (limits.maxInstancesPerBranch ?? DEFAULT_MAX_INSTANCES_PER_BRANCH) - 1,
      maxAllowedVCPUs: limits.maxAllowedInstanceType
    };
  } catch {
    return { maxReplicas: DEFAULT_MAX_INSTANCES_PER_BRANCH - 1, maxAllowedVCPUs: undefined };
  }
}

export function replicaChoicesFor(maxReplicas: number) {
  return Array.from({ length: Math.max(0, maxReplicas) + 1 }, (_, count) => ({
    name: String(count),
    message: String(count)
  }));
}

export function instanceTypeUnavailableMessage(instanceType: string): string {
  return `Instance type ${instanceType} is not available on your current plan; please add a payment method in your billing settings or contact support to enable larger instances.`;
}
