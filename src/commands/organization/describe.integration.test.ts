import { describe, expect, spyOn, test } from 'bun:test';
import stripAnsi from 'strip-ansi';
import { getNthArgOfNthCall, getTestContext, TEST_XATA_ORG } from '~/lib/test-utils';
import { implementation } from './describe';

describe('organization describe command tests', async () => {
  test('describe 404 org call', async () => {
    const context = await getTestContext();
    const organizationId = 'ORG_ID_THAT_DOES_NOT_EXIST';
    await expect(
      implementation.call(context, {
        json: true,
        organization: organizationId
      })
    ).rejects.toThrow(`access denied`);
  });

  test('describe org call with json output', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _stderrWriteSpy = spyOn(context.process.stderr, 'write');
    await implementation.call(context, {
      json: true,
      organization: TEST_XATA_ORG
    });
    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = JSON.parse(getNthArgOfNthCall(stdoutWriteSpy, 0, 0));
    expect(output).toMatchObject({
      id: TEST_XATA_ORG,
      name: TEST_XATA_ORG,
      status: {
        status: 'enabled',
        disabled_by_admin: false,
        billing_status: 'ok',
        last_updated: expect.any(String)
      }
    });
  });

  test('describe org call with table output', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _stderrWriteSpy = spyOn(context.process.stderr, 'write');
    await implementation.call(context, {
      json: false,
      organization: TEST_XATA_ORG
    });
    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = stripAnsi(getNthArgOfNthCall(stdoutWriteSpy, 0, 0)).trim();
    const expectedOutput = stripAnsi(
      context.print(
        context,
        false,
        {
          id: TEST_XATA_ORG,
          name: TEST_XATA_ORG
        },
        ['organization_id', 'name'],
        [[TEST_XATA_ORG, TEST_XATA_ORG]]
      )
    ).trim();
    expect(output).toStrictEqual(expectedOutput);
  });
});
