import { describe, expect, spyOn, test } from 'bun:test';
import stripAnsi from 'strip-ansi';
import {
  getNthArgOfNthCall,
  getTestContext,
  TEST_XATA_BRANCH_ID,
  TEST_XATA_ORG,
  TEST_XATA_PROJECT_ID
} from '~/lib/test-utils';
import { implementation } from './list';

describe('branch list command tests', async () => {
  test('list branches with json output', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _stderrWriteSpy = spyOn(context.process.stderr, 'write');

    await implementation.call(context, {
      json: true,
      organization: TEST_XATA_ORG,
      project: TEST_XATA_PROJECT_ID
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
      project: TEST_XATA_PROJECT_ID
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
      project: TEST_XATA_PROJECT_ID,
      branch: TEST_XATA_BRANCH_ID
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const output = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    console.log(output);
    expect(output).toContain('main (current)');
  });
});
