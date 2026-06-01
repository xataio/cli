import { describe, expect, spyOn, test } from 'bun:test';
import { setupChildBranch, setupTestResources } from '@xata.io/test-utils';
import stripAnsi from 'strip-ansi';
import { getNthArgOfNthCall, getTestContext, TEST_XATA_ORG } from '~/lib/test-utils';
import { implementation } from './tree';

const { project, branch } = await setupTestResources();
const { child } = await setupChildBranch();

describe('branch tree command tests', () => {
  test('tree displays branch hierarchy', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');

    await implementation.call(context, {
      organization: TEST_XATA_ORG,
      project: project.id,
      'show-id': false
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = stripAnsi(getNthArgOfNthCall(stdoutWriteSpy, 0, 0));
    expect(output.length).toBeGreaterThan(0);
    expect(output).toContain(branch.name);
  });

  test('tree with show-id flag displays branch IDs', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');

    await implementation.call(context, {
      organization: TEST_XATA_ORG,
      project: project.id,
      'show-id': true
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const output = stripAnsi(getNthArgOfNthCall(stdoutWriteSpy, 0, 0));
    expect(output).toContain(`${branch.name} (id: ${branch.id})`);
  });

  test('tree shows current branch indicator', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');

    await implementation.call(context, {
      organization: TEST_XATA_ORG,
      project: project.id,
      branch: branch.id,
      'show-id': false
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const output = stripAnsi(getNthArgOfNthCall(stdoutWriteSpy, 0, 0));
    expect(output).toContain('(current)');
  });

  test('tree with show-id and current branch shows both indicators', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');

    await implementation.call(context, {
      organization: TEST_XATA_ORG,
      project: project.id,
      branch: branch.id,
      'show-id': true
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const output = stripAnsi(getNthArgOfNthCall(stdoutWriteSpy, 0, 0));
    expect(output).toContain(`${branch.name} (id: ${branch.id}) (current)`);
  });

  test('tree handles multiple branches with parent-child relationships', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');

    await implementation.call(context, {
      organization: TEST_XATA_ORG,
      project: project.id,
      'show-id': false
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const output = stripAnsi(getNthArgOfNthCall(stdoutWriteSpy, 0, 0));
    expect(output).toContain(branch.name);
    expect(output).toContain(child.name);
  });
});
