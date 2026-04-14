import { describe, expect, spyOn, test } from 'bun:test';
import {
  getNthArgOfNthCall,
  getTestContext,
  TEST_XATA_BRANCH_ID,
  TEST_XATA_ORG,
  TEST_XATA_PROJECT_ID
} from '~/lib/test-utils';
import { implementation } from './get';
import stripAnsi from 'strip-ansi';

describe('branch get command tests', async () => {
  test('get non-existent field', async () => {
    const context = await getTestContext();
    const _stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const stderrWriteSpy = spyOn(context.process.stderr, 'write');
    const exitSpy = spyOn(context.process, 'exit');

    await implementation.call(
      context,
      {
        organization: TEST_XATA_ORG,
        project: TEST_XATA_PROJECT_ID,
        branch: TEST_XATA_BRANCH_ID
      },
      'non-existent-field'
    );

    expect(stderrWriteSpy).toHaveBeenCalled();
    expect(stderrWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = getNthArgOfNthCall(stderrWriteSpy, 0, 0);
    expect(output).toContain('Invalid field: non-existent-field');
    expect(exitSpy).toHaveBeenCalled();
    expect(getNthArgOfNthCall(exitSpy, 0, 0)).toBe(1);
  });

  test('get catalog shows field list', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _stderrWriteSpy = spyOn(context.process.stderr, 'write');
    const _exitSpy = spyOn(context.process, 'exit');

    await implementation.call(
      context,
      {
        organization: TEST_XATA_ORG,
        project: TEST_XATA_PROJECT_ID,
        branch: TEST_XATA_BRANCH_ID
      },
      '.catalog'
    );

    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output1 = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    expect(output1).toContain('Usage');
    const output2 = getNthArgOfNthCall(stdoutWriteSpy, 1, 0);
    expect(output2).toContain('The following fields are available:');
  });

  test('get branch name field', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _stderrWriteSpy = spyOn(context.process.stderr, 'write');
    const _exitSpy = spyOn(context.process, 'exit');

    await implementation.call(
      context,
      {
        organization: TEST_XATA_ORG,
        project: TEST_XATA_PROJECT_ID,
        branch: TEST_XATA_BRANCH_ID
      },
      'name'
    );

    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
    expect(output).toBe('main');
  });

  test('get branch id field', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _exitSpy = spyOn(context.process, 'exit');

    await implementation.call(
      context,
      {
        organization: TEST_XATA_ORG,
        project: TEST_XATA_PROJECT_ID,
        branch: TEST_XATA_BRANCH_ID
      },
      'id'
    );

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const output = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
    expect(output).toBe(TEST_XATA_BRANCH_ID);
  });

  test('get object field returns JSON', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');

    // Mock API to return a branch with proper structure
    const _originalApi = context.api;

    await implementation.call(
      context,
      {
        organization: TEST_XATA_ORG,
        project: TEST_XATA_PROJECT_ID,
        branch: TEST_XATA_BRANCH_ID
      },
      'configuration'
    );

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const output = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(typeof parsed).toBe('object');
    expect(parsed).toMatchObject({
      image: expect.any(String),
      instanceType: 'xata.micro',
      postgresConfigurationParameters: expect.any(Object),
      preloadLibraries: expect.arrayContaining(['pg_stat_statements']),
      region: expect.any(String),
      replicas: expect.any(Number),
      storage: expect.any(Number)
    });
  });

  test('get empty field returns empty string', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _exitSpy = spyOn(context.process, 'exit');

    await implementation.call(
      context,
      {
        organization: TEST_XATA_ORG,
        project: TEST_XATA_PROJECT_ID,
        branch: TEST_XATA_BRANCH_ID
      },
      'parentID'
    );

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const output = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    expect(output).toBe('');
  });

  test('get field with branch name argument - two args pattern', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _stderrWriteSpy = spyOn(context.process.stderr, 'write');
    const _exitSpy = spyOn(context.process, 'exit');

    await implementation.call(
      context,
      {
        organization: TEST_XATA_ORG,
        project: TEST_XATA_PROJECT_ID
      },
      'main',
      'name'
    );

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const output = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
    expect(output).toBe('main');
  });

  test('get field with branch name argument - different branch', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _stderrWriteSpy = spyOn(context.process.stderr, 'write');
    const _exitSpy = spyOn(context.process, 'exit');

    await implementation.call(
      context,
      {
        organization: TEST_XATA_ORG,
        project: TEST_XATA_PROJECT_ID
      },
      'main',
      'id'
    );

    expect(stdoutWriteSpy).toHaveBeenCalled();
    const output = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
    expect(output).toBe(TEST_XATA_BRANCH_ID);
  });

  test('no arguments shows catalog', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _stderrWriteSpy = spyOn(context.process.stderr, 'write');
    const _exitSpy = spyOn(context.process, 'exit');

    await implementation.call(context, {
      organization: TEST_XATA_ORG,
      project: TEST_XATA_PROJECT_ID,
      branch: TEST_XATA_BRANCH_ID
    });

    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output1 = getNthArgOfNthCall(stdoutWriteSpy, 0, 0);
    expect(output1).toContain('Usage');
    const output2 = getNthArgOfNthCall(stdoutWriteSpy, 1, 0);
    expect(output2).toContain('The following fields are available:');
  });

  test('three arguments shows error', async () => {
    const context = await getTestContext();
    const _stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const stderrWriteSpy = spyOn(context.process.stderr, 'write');
    const exitSpy = spyOn(context.process, 'exit');

    await implementation.call(
      context,
      {
        organization: TEST_XATA_ORG,
        project: TEST_XATA_PROJECT_ID,
        branch: TEST_XATA_BRANCH_ID
      },
      'arg1',
      'arg2',
      'arg3'
    );

    expect(stderrWriteSpy).toHaveBeenCalled();
    const output = getNthArgOfNthCall(stderrWriteSpy, 0, 0);
    expect(stripAnsi(output)).toContain('Too many arguments. Usage: xata branch get [branch] field');
    expect(exitSpy).toHaveBeenCalled();
    expect(getNthArgOfNthCall(exitSpy, 0, 0)).toBe(1);
  });
});
