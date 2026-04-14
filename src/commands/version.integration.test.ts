import { describe, expect, spyOn, test } from 'bun:test';
import stripAnsi from 'strip-ansi';
import { getNthArgOfNthCall, getTestContext } from '~/lib/test-utils';
import { implementation } from './version';

describe('version command tests', async () => {
  test('version command with json output', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    await implementation.call(context, {
      json: true,
      'skip-download': true
    });
    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = JSON.parse(getNthArgOfNthCall(stdoutWriteSpy, 0, 0));
    expect(output).toHaveProperty('CLIVersion');
    expect(output).toHaveProperty('pgrollVersion');
    expect(typeof output.CLIVersion).toBe('string');
  });

  test('version command with table output', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    await implementation.call(context, {
      json: false,
      'skip-download': true
    });
    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = stripAnsi(getNthArgOfNthCall(stdoutWriteSpy, 0, 0));
    expect(output).toContain('xata');
    expect(output).toContain('pgroll');
  });
});
