import { describe, expect, spyOn, test } from 'bun:test';
import { setupTestResources } from '@xata.io/test-utils';
import stripAnsi from 'strip-ansi';
import { getNthArgOfNthCall, getTestContext, TEST_XATA_ORG } from '~/lib/test-utils';
import { implementation } from './describe';

const { project, branch } = await setupTestResources('cli-it-');

describe('branch describe command tests', () => {
  test('describe branch with json output', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _stderrWriteSpy = spyOn(context.process.stderr, 'write');

    await implementation.call(context, {
      json: true,
      organization: TEST_XATA_ORG,
      project: project.id,
      branch: branch.id
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
      project: project.id,
      branch: branch.id
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = stripAnsi(getNthArgOfNthCall(stdoutWriteSpy, 0, 0));
    expect(output).toContain('branch_id');
    expect(output).toContain('name');
    expect(output).toContain('created_at');
    expect(output).toContain('instance_type');
    expect(output).toContain('replicas');
    expect(output).toContain('status');
  });

  test('describe specific branch by name', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');

    await implementation.call(
      context,
      {
        json: true,
        organization: TEST_XATA_ORG,
        project: project.id
      },
      branch.name
    );

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const output = JSON.parse(getNthArgOfNthCall(stdoutWriteSpy, 0, 0));
    expect(output).toHaveProperty('name');
    expect(output.name).toBe(branch.name);
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
          project: project.id
        },
        'non-existent-branch'
      )
    ).rejects.toThrow();
  });
});
