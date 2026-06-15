import { describe, expect, spyOn, test } from 'bun:test';
import { setupTestResources } from '@xata.io/test-utils';
import { getNthArgOfNthCall, getTestContext, TEST_XATA_ORG } from '~/lib/test-utils';
import { implementation } from './get';

const { project } = await setupTestResources('cli-it');

describe('project get command tests', () => {
  test('project get a non-existent field', async () => {
    const context = await getTestContext();
    const _stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const stderrWriteSpy = spyOn(context.process.stderr, 'write');
    const exitSpy = spyOn(context.process, 'exit');
    await implementation.call(
      context,
      {
        organization: TEST_XATA_ORG,
        project: project.id
      },
      'non-existent-field'
    );
    expect(stderrWriteSpy).toHaveBeenCalled();
    expect(stderrWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = (stderrWriteSpy.mock.calls[0] as [string])[0];
    expect(output).toContain('Invalid field: non-existent-field');
    expect(exitSpy).toHaveBeenCalled();
    expect(exitSpy.mock.calls.length).toBeGreaterThan(0);
    const exitCode = getNthArgOfNthCall(exitSpy, 0, 0);
    expect(exitCode).toBe(1);
  });

  test('project get id', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _stderrWriteSpy = spyOn(context.process.stderr, 'write');
    await implementation.call(
      context,
      {
        organization: TEST_XATA_ORG,
        project: project.id
      },
      'name'
    );
    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    expect(output).toStrictEqual(project.name);
  });
});
