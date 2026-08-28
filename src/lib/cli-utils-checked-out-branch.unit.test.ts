import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';

const CHECKED_OUT_BRANCH_ID = 'o5u2hfguf907tc3hkiuqfpk27k';
const OTHER_BRANCH_ID = 'oansf546nh1bf3blhj75d674gs';
const CONFIGURED_PROJECT_ID = 'prj_6a2okcu01576p925jlka0rgm2s';

mock.module('~/lib/branch-config', () => {
  return { branchConfig: { branchId: CHECKED_OUT_BRANCH_ID } };
});

mock.module('~/lib/project-config', () => {
  return { projectConfig: { projectId: CONFIGURED_PROJECT_ID } };
});

const { getBranch } = await import('./cli-utils');

function buildContext() {
  const listBranches = mock(async () => {
    return { branches: [{ id: OTHER_BRANCH_ID, name: 'main' }] };
  });

  const context = {
    api: { branches: { listBranches, describeBranch: mock(async () => ({ id: OTHER_BRANCH_ID })) } },
    process: { stderr: { write: () => undefined }, exit: mock(() => undefined) },
    isInteractive: false,
    enquirer: { selectPrompt: mock(async () => '') }
  } as unknown as LocalContext;

  return { context, listBranches };
}

describe('getBranch and the checked-out branch', () => {
  test('uses the checked-out branch as the default for the project it belongs to', async () => {
    const { context, listBranches } = buildContext();

    const branchId = await getBranch(context, {}, { organizationId: 'org-id', projectId: CONFIGURED_PROJECT_ID });

    expect(branchId).toBe(CHECKED_OUT_BRANCH_ID);
    expect(listBranches).not.toHaveBeenCalled();
  });

  test('ignores the checked-out branch when another project was asked for', async () => {
    const { context, listBranches } = buildContext();

    const branchId = await getBranch(context, {}, { organizationId: 'org-id', projectId: 'prj_a_different_project' });

    expect(branchId).not.toBe(CHECKED_OUT_BRANCH_ID);
    expect(listBranches).toHaveBeenCalledTimes(1);
  });
});
