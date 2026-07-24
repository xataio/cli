import { describe, expect, spyOn, test } from 'bun:test';
import { setupTestResources } from '@xata.io/test-utils';
import stripAnsi from 'strip-ansi';
import { getNthArgOfNthCall, getTestContext, TEST_XATA_ORG } from '~/lib/test-utils';
import { implementation } from './describe';

const { project } = await setupTestResources('cli-it');

describe('project describe command tests', () => {
  test('describe 404 project call', async () => {
    const context = await getTestContext();
    const projectId = 'PROJECT_ID_THAT_DOES_NOT_EXIST';
    await expect(
      implementation.call(context, {
        json: true,
        organization: TEST_XATA_ORG,
        project: projectId
      })
    ).rejects.toThrow(`project with ID [${projectId}] not found`);
  });

  test('describe project call with json output', async () => {
    const context = await getTestContext();
    const stdoutWriteSpy = spyOn(context.process.stdout, 'write');
    const _stderrWriteSpy = spyOn(context.process.stderr, 'write');
    await implementation.call(context, {
      json: true,
      organization: TEST_XATA_ORG,
      project: project.id
    });
    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = JSON.parse(getNthArgOfNthCall(stdoutWriteSpy, 0, 0));
    expect(output).toStrictEqual({
      id: project.id,
      name: project.name,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      configuration: {
        scaleToZero: {
          baseBranches: {
            enabled: expect.any(Boolean),
            inactivityPeriodMinutes: 30
          },
          childBranches: {
            enabled: expect.any(Boolean),
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
      project: project.id
    });
    expect(stdoutWriteSpy).toHaveBeenCalled();
    expect(stdoutWriteSpy.mock.calls.length).toBeGreaterThan(0);
    const output = stripAnsi(getNthArgOfNthCall(stdoutWriteSpy, 0, 0)).trim();

    const fetched = await context.api.projects.getProject({
      pathParams: {
        organizationID: TEST_XATA_ORG,
        projectID: project.id
      }
    });

    const expectedOutput = stripAnsi(
      context.print(
        context,
        false,
        {
          id: project.id,
          name: project.name
        },
        ['project_id', 'created_at', 'updated_at', 'name'],
        [[project.id, fetched.createdAt, fetched.updatedAt, project.name]]
      )
    );
    expect(output).toStrictEqual(expectedOutput);
  });
});
