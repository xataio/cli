import { describe, expect, spyOn, test } from 'bun:test';
import { setupTestResources } from '@xata.io/test-utils';
import { getNthArgOfNthCall, getTestContext, TEST_XATA_ORG } from '~/lib/test-utils';
import type { Types } from '@xata.io/api';
import { implementation, validateBranchStatusForUrl } from './url';

const { project, branch } = await setupTestResources('cli-it-');

describe('branch url command tests', () => {
  test('url returns connection string for healthy branch', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');

    await implementation.call(context, {
      organization: TEST_XATA_ORG,
      project: project.id,
      branch: branch.id,
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
        project: project.id,
        type: 'primary'
      },
      branch.name
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
      project: project.id,
      branch: branch.id,
      database: 'custom_db',
      type: 'primary'
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const output = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    expect(output).toContain('custom_db');
  });

  test('url for unhealthy branch shows error message', async () => {
    const context = await getTestContext();
    const stderrWriteSpy = spyOn(context.process.stderr, 'write');

    const isReady = validateBranchStatusForUrl(context, {
      status: {
        statusType: 'STATUS_TYPE_FAULT'
      }
    } as unknown as Types.BranchMetadata);

    expect(isReady).toBeFalse();
    expect(stderrWriteSpy).toHaveBeenCalled();
    const output = getNthArgOfNthCall(stderrWriteSpy, 0, 0);
    expect(output).toContain('unhealthy');
  });

  test('url with non-existent branch throws error', async () => {
    const context = await getTestContext();

    await expect(
      implementation.call(
        context,
        {
          organization: TEST_XATA_ORG,
          project: project.id,
          type: 'primary'
        },
        'non-existent-branch'
      )
    ).rejects.toThrow();
  });
});
