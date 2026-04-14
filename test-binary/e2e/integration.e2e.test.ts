import { describe, expect, test } from 'bun:test';
import { runCli } from './cli-driver';
import { TEST_XATA_BRANCH_NAME, TEST_XATA_ORG, TEST_XATA_PROJECT_ID, TEST_XATA_PROJECT_NAME } from '~/lib/test-utils';

describe('CLI binary integration tests (staging API)', () => {
  test('organization list includes e2e org', async () => {
    const result = await runCli(['organization', 'list', '--json']);

    expect(result.code).toBe(0);

    const orgs = JSON.parse(result.stdout);
    expect(Array.isArray(orgs)).toBe(true);

    const e2eOrg = orgs.find((org: { id: string }) => org.id === TEST_XATA_ORG);
    expect(e2eOrg).toBeDefined();
    expect(e2eOrg.name).toBe(TEST_XATA_ORG);
  });

  test('project list shows expected project', async () => {
    const result = await runCli(['project', 'list', '--organization', TEST_XATA_ORG, '--json']);

    expect(result.code).toBe(0);

    const projects = JSON.parse(result.stdout);
    expect(Array.isArray(projects)).toBe(true);

    const testProject = projects.find((p: { id: string }) => p.id === TEST_XATA_PROJECT_ID);
    expect(testProject).toBeDefined();
    expect(testProject.name).toBe(TEST_XATA_PROJECT_NAME);
  });

  test('branch list includes main branch', async () => {
    const result = await runCli([
      'branch',
      'list',
      '--organization',
      TEST_XATA_ORG,
      '--project',
      TEST_XATA_PROJECT_ID,
      '--json'
    ]);

    expect(result.code).toBe(0);

    const branches = JSON.parse(result.stdout);
    expect(Array.isArray(branches)).toBe(true);

    const mainBranch = branches.find((b: { name: string }) => b.name === TEST_XATA_BRANCH_NAME);
    expect(mainBranch).toBeDefined();
  });
});
