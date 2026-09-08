import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { getBranchDeletionBlocker, getChildBranchDefaults } from './branch-actions';

describe('branch actions', () => {
  test('blocks deleting the checked out branch', () => {
    expect(getBranchDeletionBlocker('branch-1', 'branch-1')).toBe('Cannot delete the current checked out branch');
    expect(getBranchDeletionBlocker('branch-1', 'branch-2')).toBeNull();
    expect(getBranchDeletionBlocker('branch-1', null)).toBeNull();
  });

  test('reads child branch defaults from project configuration', async () => {
    const getProject = mock(async () => ({
      configuration: {
        scaleToZero: {
          baseBranches: { enabled: false, inactivityPeriodMinutes: 180 },
          childBranches: { enabled: true, inactivityPeriodMinutes: 30 }
        }
      }
    }));
    const context = { api: { projects: { getProject } } } as unknown as LocalContext;

    const defaults = await getChildBranchDefaults(context, 'org-1', 'project-1');

    expect(defaults).toEqual({ scaleToZero: true, inactivityPeriodMinutes: 30 });
    expect(getProject).toHaveBeenCalledWith({
      pathParams: { organizationID: 'org-1', projectID: 'project-1' }
    });
  });
});
