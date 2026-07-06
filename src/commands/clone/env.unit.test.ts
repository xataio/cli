import { describe, expect, it, beforeEach, spyOn } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { LocalContext } from '~/context';
import { getPgStreamStartEnv, getPgStreamStreamEnv } from './env';

function createMockContext(debug = false): LocalContext {
  return {
    debug,
    fs,
    os,
    path,
    env: {},
    isInteractive: true,
    process: {
      stdout: { write: () => {} },
      stderr: { write: () => {} },
      exit: () => {}
    }
  } as any;
}

describe('clone env tests', () => {
  let context: LocalContext;
  const mockSourceUrl = 'postgresql://user:pass@source-host:5432/sourcedb';
  const mockTargetUrl = 'postgresql://user:pass@target-host:5432/targetdb';
  const mockFilterTables = '*.*';
  const mockRole = 'test_role';

  beforeEach(() => {
    context = createMockContext();
    process.env = {};
  });

  describe('getPgStreamStartEnv', () => {
    describe('copyRoles parameter behavior', () => {
      it('should set correct env vars when copyRoles is false (default)', () => {
        const env = getPgStreamStartEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables);

        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLES_SNAPSHOT_MODE).toBe('disabled');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_OWNER).toBe('true');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_PRIVILEGES).toBe('true');
      });

      it('should set correct env vars when copyRoles is explicitly false', () => {
        const env = getPgStreamStartEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables, undefined, false);

        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLES_SNAPSHOT_MODE).toBe('disabled');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_OWNER).toBe('true');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_PRIVILEGES).toBe('true');
      });

      it('should set correct env vars when copyRoles is true', () => {
        const env = getPgStreamStartEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables, undefined, true);

        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLES_SNAPSHOT_MODE).toBe('no_passwords');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_OWNER).toBe('false');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_PRIVILEGES).toBe('false');
      });
    });

    describe('common environment variables', () => {
      it('should set all required pgstream environment variables', () => {
        const env = getPgStreamStartEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables);

        expect(env.PGSTREAM_POSTGRES_LISTENER_URL).toBe(mockSourceUrl);
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_TABLES).toBe(mockFilterTables);
        expect(env.PGSTREAM_POSTGRES_WRITER_TARGET_URL).toBe(mockTargetUrl);
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_STORE_URL).toBe(mockTargetUrl);
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_STORE_REPEATABLE).toBe('true');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_CLEAN_TARGET_DB).toBe('true');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_INCLUDE_GLOBAL_DB_OBJECTS).toBe('false');
        expect(env.PGSTREAM_POSTGRES_WRITER_ON_CONFLICT_ACTION).toBe('error');
        expect(env.PGSTREAM_POSTGRES_WRITER_DISABLE_TRIGGERS).toBe('true');
      });

      it('should allow overriding global database object snapshots', () => {
        process.env = { PGSTREAM_POSTGRES_SNAPSHOT_INCLUDE_GLOBAL_DB_OBJECTS: 'true' };

        const env = getPgStreamStartEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables);

        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_INCLUDE_GLOBAL_DB_OBJECTS).toBe('true');
      });

      it('should set role when provided', () => {
        const env = getPgStreamStartEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables, mockRole);

        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLE).toBe(mockRole);
      });

      it('should not set role when not provided', () => {
        const env = getPgStreamStartEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables);

        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLE).toBeUndefined();
      });
    });

    describe('copyRoles with role parameter', () => {
      it('should set correct env vars when both role and copyRoles=true are provided', () => {
        const env = getPgStreamStartEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables, mockRole, true);

        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLE).toBe(mockRole);
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLES_SNAPSHOT_MODE).toBe('no_passwords');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_OWNER).toBe('false');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_PRIVILEGES).toBe('false');
      });

      it('should set correct env vars when role is provided but copyRoles=false', () => {
        const env = getPgStreamStartEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables, mockRole, false);

        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLE).toBe(mockRole);
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLES_SNAPSHOT_MODE).toBe('disabled');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_OWNER).toBe('true');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_PRIVILEGES).toBe('true');
      });
    });
  });

  describe('getPgStreamStreamEnv', () => {
    describe('copyRoles parameter behavior', () => {
      it('should set correct env vars when copyRoles is false (default)', () => {
        const env = getPgStreamStreamEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables);

        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLES_SNAPSHOT_MODE).toBe('disabled');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_OWNER).toBe('true');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_PRIVILEGES).toBe('true');
      });

      it('should set correct env vars when copyRoles is explicitly false', () => {
        const env = getPgStreamStreamEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables, undefined, false);

        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLES_SNAPSHOT_MODE).toBe('disabled');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_OWNER).toBe('true');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_PRIVILEGES).toBe('true');
      });

      it('should set correct env vars when copyRoles is true', () => {
        const env = getPgStreamStreamEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables, undefined, true);

        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLES_SNAPSHOT_MODE).toBe('no_passwords');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_OWNER).toBe('false');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_PRIVILEGES).toBe('false');
      });
    });

    describe('common environment variables', () => {
      it('should set all required pgstream environment variables for streaming', () => {
        const env = getPgStreamStreamEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables);

        expect(env.PGSTREAM_POSTGRES_LISTENER_URL).toBe(mockSourceUrl);
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_TABLES).toBe(mockFilterTables);
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_EXCLUDED_TABLES).toBe('pgstream.*');
        expect(env.PGSTREAM_POSTGRES_WRITER_TARGET_URL).toBe(mockTargetUrl);
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_STORE_URL).toBe(mockSourceUrl);
        expect(env.PGSTREAM_POSTGRES_WRITER_SCHEMALOG_STORE_URL).toBe(mockSourceUrl);
        expect(env.PGSTREAM_INJECTOR_STORE_POSTGRES_URL).toBe(mockSourceUrl);
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_STORE_REPEATABLE).toBe('false');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_CLEAN_TARGET_DB).toBe('true');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_INCLUDE_GLOBAL_DB_OBJECTS).toBe('false');
        expect(env.PGSTREAM_POSTGRES_WRITER_ON_CONFLICT_ACTION).toBe('error');
        expect(env.PGSTREAM_POSTGRES_WRITER_DISABLE_TRIGGERS).toBe('true');
      });

      it('should allow overriding global database object snapshots', () => {
        process.env = { PGSTREAM_POSTGRES_SNAPSHOT_INCLUDE_GLOBAL_DB_OBJECTS: 'true' };

        const env = getPgStreamStreamEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables);

        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_INCLUDE_GLOBAL_DB_OBJECTS).toBe('true');
      });

      it('should set role when provided', () => {
        const env = getPgStreamStreamEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables, mockRole);

        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLE).toBe(mockRole);
      });

      it('should not set role when not provided', () => {
        const env = getPgStreamStreamEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables);

        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLE).toBeUndefined();
      });
    });

    describe('copyRoles with role parameter', () => {
      it('should set correct env vars when both role and copyRoles=true are provided', () => {
        const env = getPgStreamStreamEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables, mockRole, true);

        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLE).toBe(mockRole);
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLES_SNAPSHOT_MODE).toBe('no_passwords');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_OWNER).toBe('false');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_PRIVILEGES).toBe('false');
      });

      it('should set correct env vars when role is provided but copyRoles=false', () => {
        const env = getPgStreamStreamEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables, mockRole, false);

        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLE).toBe(mockRole);
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLES_SNAPSHOT_MODE).toBe('disabled');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_OWNER).toBe('true');
        expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_PRIVILEGES).toBe('true');
      });
    });
  });

  describe('getPgStreamStreamEnv with skipDdlTracking', () => {
    it('should set PGSTREAM_POSTGRES_WRITER_IGNORE_DDL=true when skipDdlTracking is true', () => {
      const env = getPgStreamStreamEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables, undefined, false, true);

      expect(env.PGSTREAM_POSTGRES_WRITER_IGNORE_DDL).toBe('true');
    });

    it('should not set PGSTREAM_POSTGRES_WRITER_SCHEMALOG_STORE_URL when skipDdlTracking is true', () => {
      const env = getPgStreamStreamEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables, undefined, false, true);

      expect(env.PGSTREAM_POSTGRES_WRITER_SCHEMALOG_STORE_URL).toBeUndefined();
    });

    it('should not set PGSTREAM_POSTGRES_WRITER_IGNORE_DDL when skipDdlTracking is false', () => {
      const env = getPgStreamStreamEnv(
        context,
        mockSourceUrl,
        mockTargetUrl,
        mockFilterTables,
        undefined,
        false,
        false
      );

      expect(env.PGSTREAM_POSTGRES_WRITER_IGNORE_DDL).toBeUndefined();
    });

    it('should set PGSTREAM_POSTGRES_WRITER_SCHEMALOG_STORE_URL when skipDdlTracking is false', () => {
      const env = getPgStreamStreamEnv(
        context,
        mockSourceUrl,
        mockTargetUrl,
        mockFilterTables,
        undefined,
        false,
        false
      );

      expect(env.PGSTREAM_POSTGRES_WRITER_SCHEMALOG_STORE_URL).toBe(mockSourceUrl);
    });

    it('should still set all other required env vars when skipDdlTracking is true', () => {
      const env = getPgStreamStreamEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables, undefined, false, true);

      expect(env.PGSTREAM_POSTGRES_LISTENER_URL).toBe(mockSourceUrl);
      expect(env.PGSTREAM_POSTGRES_SNAPSHOT_TABLES).toBe(mockFilterTables);
      expect(env.PGSTREAM_POSTGRES_SNAPSHOT_EXCLUDED_TABLES).toBe('pgstream.*');
      expect(env.PGSTREAM_POSTGRES_WRITER_TARGET_URL).toBe(mockTargetUrl);
      expect(env.PGSTREAM_POSTGRES_SNAPSHOT_STORE_URL).toBe(mockSourceUrl);
      expect(env.PGSTREAM_INJECTOR_STORE_POSTGRES_URL).toBe(mockSourceUrl);
      expect(env.PGSTREAM_POSTGRES_SNAPSHOT_INCLUDE_GLOBAL_DB_OBJECTS).toBe('false');
      expect(env.PGSTREAM_POSTGRES_WRITER_ON_CONFLICT_ACTION).toBe('error');
      expect(env.PGSTREAM_POSTGRES_WRITER_DISABLE_TRIGGERS).toBe('true');
    });

    it('should work with skipDdlTracking and copyRoles combined', () => {
      const env = getPgStreamStreamEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables, mockRole, true, true);

      expect(env.PGSTREAM_POSTGRES_WRITER_IGNORE_DDL).toBe('true');
      expect(env.PGSTREAM_POSTGRES_WRITER_SCHEMALOG_STORE_URL).toBeUndefined();
      expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLE).toBe(mockRole);
      expect(env.PGSTREAM_POSTGRES_SNAPSHOT_ROLES_SNAPSHOT_MODE).toBe('no_passwords');
      expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_OWNER).toBe('false');
      expect(env.PGSTREAM_POSTGRES_SNAPSHOT_NO_PRIVILEGES).toBe('false');
    });
  });

  describe('difference between start and stream environments', () => {
    it('should use targetUrl for snapshot store in start command', () => {
      const envStart = getPgStreamStartEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables);
      expect(envStart.PGSTREAM_POSTGRES_SNAPSHOT_STORE_URL).toBe(mockTargetUrl);
      expect(envStart.PGSTREAM_POSTGRES_SNAPSHOT_STORE_REPEATABLE).toBe('true');
    });

    it('should use sourceUrl for snapshot store in stream command', () => {
      const envStream = getPgStreamStreamEnv(context, mockSourceUrl, mockTargetUrl, mockFilterTables);
      expect(envStream.PGSTREAM_POSTGRES_SNAPSHOT_STORE_URL).toBe(mockSourceUrl);
      expect(envStream.PGSTREAM_POSTGRES_WRITER_SCHEMALOG_STORE_URL).toBe(mockSourceUrl);
      expect(envStream.PGSTREAM_INJECTOR_STORE_POSTGRES_URL).toBe(mockSourceUrl);
      expect(envStream.PGSTREAM_POSTGRES_SNAPSHOT_STORE_REPEATABLE).toBe('false');
      expect(envStream.PGSTREAM_POSTGRES_SNAPSHOT_EXCLUDED_TABLES).toBe('pgstream.*');
    });
  });

  describe('debug logging', () => {
    it('should call console.log when debug is enabled for start command', () => {
      const debugContext = createMockContext(true);
      const consoleLogSpy = spyOn(console, 'log');

      getPgStreamStartEnv(debugContext, mockSourceUrl, mockTargetUrl, mockFilterTables);

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls;
      expect(calls.some((call) => call[0]?.includes('PGStream Start Environment Variables'))).toBe(true);

      consoleLogSpy.mockRestore();
    });

    it('should call console.log when debug is enabled for stream command', () => {
      const debugContext = createMockContext(true);
      const consoleLogSpy = spyOn(console, 'log');

      getPgStreamStreamEnv(debugContext, mockSourceUrl, mockTargetUrl, mockFilterTables);

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls;
      expect(calls.some((call) => call[0]?.includes('PGStream Stream Environment Variables'))).toBe(true);

      consoleLogSpy.mockRestore();
    });

    it('should not call console.log when debug is disabled', () => {
      const nonDebugContext = createMockContext(false);
      const consoleLogSpy = spyOn(console, 'log');

      getPgStreamStartEnv(nonDebugContext, mockSourceUrl, mockTargetUrl, mockFilterTables);

      expect(consoleLogSpy).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });
  });
});
