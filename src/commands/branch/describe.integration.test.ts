import { describe, expect, spyOn, test } from 'bun:test';
import stripAnsi from 'strip-ansi';
import {
  getNthArgOfNthCall,
  getTestContext,
  TEST_XATA_BRANCH_ID,
  TEST_XATA_ORG,
  TEST_XATA_PROJECT_ID
} from '~/lib/test-utils';
import { implementation } from './describe';

describe('branch describe command tests', async () => {
  test('describe branch with json output', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _stderrWriteSpy = spyOn(context.process.stderr, 'write');

    await implementation.call(context, {
      json: true,
      organization: TEST_XATA_ORG,
      project: TEST_XATA_PROJECT_ID,
      branch: TEST_XATA_BRANCH_ID
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = JSON.parse(getNthArgOfNthCall(stdoutWriteSpy, 0, 0));
    expect(output).toHaveProperty('id');
    expect(output).toHaveProperty('name');
    expect(output).toHaveProperty('createdAt');
    expect(output).toHaveProperty('status');
    expect(output).toHaveProperty('configuration');
  });

  test('describe branch with table output', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _stderrWriteSpy = spyOn(context.process.stderr, 'write');

    await implementation.call(context, {
      json: false,
      organization: TEST_XATA_ORG,
      project: TEST_XATA_PROJECT_ID,
      branch: TEST_XATA_BRANCH_ID
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = stripAnsi(getNthArgOfNthCall(stdoutWriteSpy, 0, 0));
    expect(output).toContain('Branch ID');
    expect(output).toContain('Name');
    expect(output).toContain('Created At');
    expect(output).toContain('Instance Type');
    expect(output).toContain('Replicas');
    expect(output).toContain('Status');
  });

  test('describe specific branch by name', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');

    await implementation.call(
      context,
      {
        json: true,
        organization: TEST_XATA_ORG,
        project: TEST_XATA_PROJECT_ID
      },
      'main'
    );

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const output = JSON.parse(getNthArgOfNthCall(stdoutWriteSpy, 0, 0));
    expect(output).toHaveProperty('name');
    expect(output.name).toBe('main');
  });

  test('describe non-existent branch', async () => {
    const context = await getTestContext();
    const _stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _stderrWriteSpy = spyOn(context.process.stderr, 'write');

    await expect(
      implementation.call(
        context,
        {
          json: true,
          organization: TEST_XATA_ORG,
          project: TEST_XATA_PROJECT_ID
        },
        'non-existent-branch'
      )
    ).rejects.toThrow();
  });
});
