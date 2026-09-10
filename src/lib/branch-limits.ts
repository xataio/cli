import { branchLimitsFrom, type BranchLimits, replicaCountOptions, storageLimitMessage } from '@xata.io/utils';
import type { LocalContext } from '~/context';

async function fetchBranchLimits(context: LocalContext, organizationId: string): Promise<BranchLimits> {
  try {
    const limits = await context.api.projects.getOrganizationLimits({
      pathParams: { organizationID: organizationId }
    });
    return branchLimitsFrom(limits);
  } catch {
    return branchLimitsFrom();
  }
}

// A single command asks for limits from several places, so the in-flight request is shared
// rather than repeated. Keyed by context so each process, and each test, gets its own.
const limitsByContext = new WeakMap<LocalContext, Map<string, Promise<BranchLimits>>>();

// Effective instance/replica/storage/description limits for the org. Falls back to today's
// defaults if the limits endpoint is unavailable, so commands never fail on limits alone.
export async function getBranchLimits(context: LocalContext, organizationId: string): Promise<BranchLimits> {
  let byOrganization = limitsByContext.get(context);
  if (!byOrganization) {
    byOrganization = new Map();
    limitsByContext.set(context, byOrganization);
  }
  const cached = byOrganization.get(organizationId);
  if (cached) {
    return cached;
  }
  const limits = fetchBranchLimits(context, organizationId);
  byOrganization.set(organizationId, limits);
  return limits;
}

export function replicaChoicesFor(maxReplicas: number) {
  return replicaCountOptions(maxReplicas).map((count) => ({
    name: String(count),
    message: String(count)
  }));
}

// A valid payment method on file moves the org to usage tier t2, so the tier doubles as a
// "has payment method" signal. Defaults to false (offer the billing hint) if the lookup fails.
async function hasPaymentMethod(context: LocalContext, organizationId: string): Promise<boolean> {
  try {
    const organization = await context.api.organizations.getOrganization({
      pathParams: { organizationID: organizationId }
    });
    return organization.status.usage_tier === 't2';
  } catch {
    return false;
  }
}

type StorageValidationOptions = {
  maxStorage?: number;
  currentStorage?: number;
};

// Returns why the API or the org's plan would reject this storage size, or null when it is
// acceptable. `currentStorage` is only passed when resizing an existing branch, since the API
// never shrinks a disk that already exists.
export async function storageValidationError(
  context: LocalContext,
  organizationId: string,
  value: string,
  { maxStorage, currentStorage }: StorageValidationOptions
): Promise<string | null> {
  const storageGB = Number(value);
  if (!Number.isInteger(storageGB) || storageGB < 1) {
    return `Invalid storage value: ${value}. Storage must be a whole number of GB.`;
  }
  if (currentStorage !== undefined && storageGB < currentStorage) {
    return `Storage cannot be decreased (current: ${currentStorage} GB).`;
  }
  if (maxStorage !== undefined && storageGB > maxStorage) {
    return storageLimitMessage(maxStorage, await hasPaymentMethod(context, organizationId));
  }
  return null;
}
