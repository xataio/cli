import { describe, expect, spyOn, test } from 'bun:test';
import { setupTestResources } from '@xata.io/test-utils';
import stripAnsi from 'strip-ansi';
import { getNthArgOfNthCall, getTestContext, TEST_XATA_ORG } from '~/lib/test-utils';
import { implementation } from './list';

describe('branch list command tests', () => {
  const { project, branch } = setupTestResources();

  test('list branches with json output', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _stderrWriteSpy = spyOn(context.process.stderr, 'write');

    await implementation.call(context, {
      json: true,
      organization: TEST_XATA_ORG,
      project: project.id
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = JSON.parse(getNthArgOfNthCall(stdoutWriteSpy, 0, 0));
    expect(Array.isArray(output)).toBe(true);
    if (output.length > 0) {
      expect(output[0]).toHaveProperty('id');
      expect(output[0]).toHaveProperty('name');
      expect(output[0]).toHaveProperty('createdAt');
    }
  });

  test('list branches with table output', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _stderrWriteSpy = spyOn(context.process.stderr, 'write');

    await implementation.call(context, {
      json: false,
      organization: TEST_XATA_ORG,
      project: project.id
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = stripAnsi(getNthArgOfNthCall(stdoutWriteSpy, 0, 0));
    expect(output).toContain('ID');
    expect(output).toContain('Name');
    expect(output).toContain('Created At');
    expect(output).toContain('Parent ID');
  });

  test('list branches with specific branch context', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');

    await implementation.call(context, {
      json: false,
      organization: TEST_XATA_ORG,
      project: project.id,
      branch: branch.id
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const output = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    expect(output).toContain(`${branch.name} (current)`);
  });
});
