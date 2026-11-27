import { describe, expect, test } from 'bun:test';
import type { Types } from '@xata.io/api';
import { getReplicaConnectionWarning, type BranchConnectionType } from './branch-connection';

const branchWithReplicas = (replicas: number) => ({ configuration: { replicas } }) as Types.BranchMetadata;

describe('getReplicaConnectionWarning', () => {
  test.each<BranchConnectionType>(['replica', 'primary-or-replica'])('warns for %s without replicas', (type) => {
    expect(getReplicaConnectionWarning(type, branchWithReplicas(0))).toContain(`The ${type} endpoint needs a replica`);
  });

  test.each<BranchConnectionType>(['replica', 'primary-or-replica'])('does not warn for %s with replicas', (type) => {
    expect(getReplicaConnectionWarning(type, branchWithReplicas(1))).toBeNull();
  });

  test.each<BranchConnectionType>(['primary', 'pooler'])('does not warn for %s without replicas', (type) => {
    expect(getReplicaConnectionWarning(type, branchWithReplicas(0))).toBeNull();
  });
});
