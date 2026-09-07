import { describe, expect, test } from 'bun:test';
import { getBranchDeletionBlocker } from './branch-actions';

describe('branch actions', () => {
  test('blocks deleting the checked out branch', () => {
    expect(getBranchDeletionBlocker('branch-1', 'branch-1')).toBe('Cannot delete the current checked out branch');
    expect(getBranchDeletionBlocker('branch-1', 'branch-2')).toBeNull();
    expect(getBranchDeletionBlocker('branch-1', null)).toBeNull();
  });
});
