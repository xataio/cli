import { describe, expect, spyOn, test } from 'bun:test';
import { setupTestResources } from '@xata.io/test-utils';
import { getNthArgOfNthCall, getTestContext, TEST_XATA_ORG } from '~/lib/test-utils';
import { implementation } from './list';

const { project } = await setupTestResources();

describe('project list command with tests', () => {
  test('list projects with json output', async () => {
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
          id: project.id,
          name: project.name,
          createdAt: expect.any(String),
          updatedAt: expect.any(String)
        })
      ])
    );
  });
});
