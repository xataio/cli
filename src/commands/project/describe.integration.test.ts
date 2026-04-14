import { describe, expect, spyOn, test } from 'bun:test';
import stripAnsi from 'strip-ansi';
import {
  getNthArgOfNthCall,
  getTestContext,
  TEST_XATA_ORG,
  TEST_XATA_PROJECT_ID,
  TEST_XATA_PROJECT_NAME
} from '~/lib/test-utils';
import { implementation } from './describe';

describe('project describe command tests', async () => {
  test('describe 404 project call', async () => {
    const context = await getTestContext();
    const projectId = 'PROJECT_ID_THAT_DOES_NOT_EXIST';
    await expect(
      implementation.call(context, {
        json: true,
        organization: TEST_XATA_ORG,
        project: projectId
      })
    ).rejects.toThrow(`project [${projectId}] not found`);
  });

  test('describe project call with json output', async () => {
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
    expect(output).toStrictEqual({
      id: TEST_XATA_PROJECT_ID,
      name: TEST_XATA_PROJECT_NAME,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      configuration: {
        scaleToZero: {
          baseBranches: {
            enabled: false,
            inactivityPeriodMinutes: 30
          },
          childBranches: {
            enabled: false,
            inactivityPeriodMinutes: 30
          }
        }
      }
    });
  });

  test('describe project call with table output', async () => {
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
    const output = stripAnsi(getNthArgOfNthCall(stdoutWriteSpy, 0, 0)).trim();

    const project = await context.api.projects.getProject({
      pathParams: {
        organizationID: TEST_XATA_ORG,
        projectID: TEST_XATA_PROJECT_ID
      }
    });

    const expectedOutput = stripAnsi(
      context.print(
        context,
        false,
        {
          id: TEST_XATA_PROJECT_ID,
          name: TEST_XATA_PROJECT_NAME
        },
        ['ID', 'Created At', 'Updated At', 'Name'],
        [[TEST_XATA_PROJECT_ID, project.createdAt, project.updatedAt, TEST_XATA_PROJECT_NAME]]
      )
    );
    expect(output).toStrictEqual(expectedOutput);
  });
});
