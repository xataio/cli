import { describe, expect, mock, spyOn, test } from 'bun:test';
import {
  getNthArgOfNthCall,
  getTestContext,
  TEST_XATA_BRANCH_ID,
  TEST_XATA_ORG,
  TEST_XATA_PROJECT_ID
} from '~/lib/test-utils';
import type { BranchMetadata } from '../../../../../packages/api/src/generated/types';
import { implementation } from './url';

describe('branch url command tests', async () => {
  test('url returns connection string for healthy branch', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');

    await implementation.call(context, {
      organization: TEST_XATA_ORG,
      project: TEST_XATA_PROJECT_ID,
      branch: TEST_XATA_BRANCH_ID,
      type: 'primary'
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    expect(output).toContain('postgresql://');
  });

  test('url with specific branch name', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');

    await implementation.call(
      context,
      {
        organization: TEST_XATA_ORG,
        project: TEST_XATA_PROJECT_ID,
        type: 'primary'
      },
      'main'
    );

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const output = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    expect(output).toContain('postgresql://');
  });

  test('url with custom database name', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');

    await implementation.call(context, {
      organization: TEST_XATA_ORG,
      project: TEST_XATA_PROJECT_ID,
      branch: TEST_XATA_BRANCH_ID,
      database: 'custom_db',
      type: 'primary'
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const output = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    expect(output).toContain('custom_db');
  });

  test.skip('url for unhealthy branch shows error message', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _stderrWriteSpy = spyOn(context.process.stderr, 'write');

    context.api.branches.describeBranch = mock(() => {
      return Promise.resolve({
        status: {
          statusType: 'STATUS_TYPE_UNSPECIFIED'
        }
      } as unknown as BranchMetadata);
    });

    await implementation.call(context, {
      organization: TEST_XATA_ORG,
      project: TEST_XATA_PROJECT_ID,
      branch: TEST_XATA_BRANCH_ID,
      type: 'primary'
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const output = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    expect(output).toContain('not healthy');
  });

  test('url with non-existent branch throws error', async () => {
    const context = await getTestContext();

    await expect(
      implementation.call(
        context,
        {
          organization: TEST_XATA_ORG,
          project: TEST_XATA_PROJECT_ID,
          type: 'primary'
        },
        'non-existent-branch'
      )
    ).rejects.toThrow();
  });
});
