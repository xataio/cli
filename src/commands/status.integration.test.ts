import { describe, expect, spyOn, test } from 'bun:test';
import { getNthArgOfNthCall, getTestContext } from '~/lib/test-utils';
import { implementation } from './status';

describe('status command tests', async () => {
  test('status command when not initialized', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    await implementation.call(context, {
      json: false
    });
    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    expect(output).toContain("Couldn't find a project config");
  });

  test('status command with json when not initialized', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    await implementation.call(context, {
      json: true
    });
    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    expect(output).toContain("Couldn't find a project config");
  });
});
