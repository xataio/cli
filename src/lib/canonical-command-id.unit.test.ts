import { buildApplication, buildCommand, buildRouteMap } from '@stricli/core';
import { describe, expect, test } from 'bun:test';
import { getCanonicalCommandId } from './canonical-command-id';

const leaf = buildCommand({ docs: { brief: '' }, parameters: {}, func: () => {} });

const MembersRoute = buildRouteMap({
  docs: { brief: '' },
  routes: { list: leaf, invite: leaf },
  aliases: { ls: 'list', add: 'invite' }
});

const OrganizationRoute = buildRouteMap({
  docs: { brief: '' },
  routes: { list: leaf, describe: leaf, members: MembersRoute },
  aliases: { ls: 'list', view: 'describe' }
});

const routes = buildRouteMap({
  docs: { brief: '' },
  routes: { organization: OrganizationRoute, status: leaf },
  aliases: { org: 'organization' }
});

const app = buildApplication(routes, { name: 'test-cli' });

const testCases = [
  { name: 'direct command', prefix: ['status'], expected: 'status' },
  { name: 'nested command', prefix: ['organization', 'list'], expected: 'organization:list' },
  { name: 'root alias', prefix: ['org', 'ls'], expected: 'organization:list' },
  { name: 'nested alias', prefix: ['org', 'view'], expected: 'organization:describe' },
  { name: 'deeply nested alias', prefix: ['org', 'members', 'add'], expected: 'organization:members:invite' },
  { name: 'deeply nested mixed', prefix: ['organization', 'members', 'ls'], expected: 'organization:members:list' },
  { name: 'strips app name prefix', prefix: ['test-cli', 'org', 'ls'], expected: 'organization:list' },
  { name: 'empty prefix', prefix: [] as string[], expected: '' },
  { name: 'unknown root segment', prefix: ['nonexistent'], expected: '' },
  { name: 'unknown nested segment', prefix: ['organization', 'nonexistent'], expected: 'organization' }
];

describe('getCanonicalCommandId', () => {
  for (const { name, prefix, expected } of testCases) {
    test(name, () => {
      expect(getCanonicalCommandId(app, prefix)).toBe(expected);
    });
  }
});
