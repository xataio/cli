import { describe, expect, test } from 'bun:test';
import { setupTestResources } from '@xata.io/test-utils';
import { runCli } from './cli-driver';
import { TEST_XATA_ORG } from '~/lib/test-utils';

const { project, branch } = await setupTestResources('cli-it');

describe('CLI binary integration tests (staging API)', () => {
  test('organization list includes the e2e org', async () => {
    const result = await runCli(['organization', 'list', '--json']);

    expect(result.code).toBe(0);

    const orgs = JSON.parse(result.stdout);
    expect(Array.isArray(orgs)).toBe(true);

    const e2eOrg = orgs.find((org: { id: string }) => org.id === TEST_XATA_ORG);
    expect(e2eOrg).toBeDefined();
    expect(e2eOrg.name).toBe(TEST_XATA_ORG);
  });

  test('project list includes the provisioned project', async () => {
    const result = await runCli(['project', 'list', '--organization', TEST_XATA_ORG, '--json']);

    expect(result.code).toBe(0);

    const projects = JSON.parse(result.stdout);
    expect(Array.isArray(projects)).toBe(true);

    const match = projects.find((p: { id: string }) => p.id === project.id);
    expect(match).toBeDefined();
    expect(match.name).toBe(project.name);
  });

  test('branch list includes the provisioned branch', async () => {
    const result = await runCli(['branch', 'list', '--organization', TEST_XATA_ORG, '--project', project.id, '--json']);

    expect(result.code).toBe(0);

    const branches = JSON.parse(result.stdout);
    expect(Array.isArray(branches)).toBe(true);

    const match = branches.find((b: { name: string }) => b.name === branch.name);
    expect(match).toBeDefined();
  });
});
