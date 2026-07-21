/* biome-ignore-all lint/style/noProcessEnv: This test verifies that loadEnvConfig defaults to process.env */

import { describe, expect, test } from 'bun:test';
import { loadEnvConfig } from './env';

describe('loadEnvConfig', () => {
  const aliasCases = [
    { key: 'organizationId', preferred: 'XATA_ORGANIZATION_ID', legacy: 'XATA_ORGANIZATIONID' },
    { key: 'projectId', preferred: 'XATA_PROJECT_ID', legacy: 'XATA_PROJECTID' },
    { key: 'branchId', preferred: 'XATA_BRANCH_ID', legacy: 'XATA_BRANCHID' },
    { key: 'branchName', preferred: 'XATA_BRANCH_NAME', legacy: 'XATA_BRANCHNAME' },
    { key: 'databaseName', preferred: 'XATA_DATABASE_NAME', legacy: 'XATA_DATABASENAME' }
  ];

  for (const { key, preferred, legacy } of aliasCases) {
    test(`reads ${preferred} (snake case)`, () => {
      expect(loadEnvConfig([key], { [preferred]: 'value' })).toEqual({ [key]: 'value' });
    });

    test(`reads ${legacy} (legacy)`, () => {
      expect(loadEnvConfig([key], { [legacy]: 'value' })).toEqual({ [key]: 'value' });
    });

    test(`${preferred} wins over ${legacy} when both are set`, () => {
      expect(loadEnvConfig([key], { [preferred]: 'new', [legacy]: 'old' })).toEqual({ [key]: 'new' });
    });
  }

  test('returns the value when both forms are set to the same value', () => {
    expect(loadEnvConfig(['projectId'], { XATA_PROJECT_ID: 'same', XATA_PROJECTID: 'same' })).toEqual({
      projectId: 'same'
    });
  });

  test('falls back to legacy when the preferred name is an empty string', () => {
    expect(loadEnvConfig(['branchId'], { XATA_BRANCH_ID: '', XATA_BRANCHID: 'legacy' })).toEqual({
      branchId: 'legacy'
    });
  });

  test('omits the key when both forms are empty strings', () => {
    expect(loadEnvConfig(['branchId'], { XATA_BRANCH_ID: '', XATA_BRANCHID: '' })).toEqual({});
  });

  test('omits the key when neither form is set', () => {
    expect(loadEnvConfig(['organizationId'], {})).toEqual({});
  });

  test('loads multiple keys without leaking unrelated variables', () => {
    const source = {
      XATA_ORGANIZATION_ID: 'org_123',
      XATA_PROJECTID: 'proj_456',
      XATA_UNRELATED: 'nope',
      OTHER: 'nope'
    };
    expect(loadEnvConfig(['organizationId', 'projectId', 'branchId'], source)).toEqual({
      organizationId: 'org_123',
      projectId: 'proj_456'
    });
  });

  test('unmapped keys still read the generated legacy name', () => {
    expect(loadEnvConfig(['someFutureKey'], { XATA_SOMEFUTUREKEY: 'value' })).toEqual({
      someFutureKey: 'value'
    });
  });

  test('defaults to process.env when no source is given', () => {
    process.env.XATA_ORGANIZATION_ID = 'from_process_env';
    try {
      expect(loadEnvConfig(['organizationId'])).toEqual({ organizationId: 'from_process_env' });
    } finally {
      delete process.env.XATA_ORGANIZATION_ID;
    }
  });
});
