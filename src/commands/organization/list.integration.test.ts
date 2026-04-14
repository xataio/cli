import { describe, expect, spyOn, test } from 'bun:test';
import { getNthArgOfNthCall, getTestContext, TEST_XATA_ORG } from '~/lib/test-utils';
import { implementation } from './list';

describe('organization list command tests', async () => {
  test('list org call with json output', async () => {
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
    expect(output).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: TEST_XATA_ORG,
          name: TEST_XATA_ORG,
          status: expect.objectContaining({
            status: 'enabled',
            disabled_by_admin: false,
            billing_status: 'ok',
            last_updated: expect.any(String)
          })
        })
      ])
    );
  });
});
