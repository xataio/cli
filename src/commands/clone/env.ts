/* biome-ignore-all lint/style/noProcessEnv: It's correct to access environment variables here */

import { z } from 'zod';
import type { LocalContext } from '~/context';
import { DEFAULT_CLONE_RULES_FILE } from '~/lib/constants';
import { doesCloneYamlFileExist } from './start';
import { buildConnectionString } from '@xata.io/sql';

function logPgStreamEnv(
  context: LocalContext,
  title: string,
  schema: z.ZodObject<any>,
  listenerUrl: string,
  writerTargetUrl: string,
  snapshotStoreUrl: string
) {
  if (context.debug) {
    console.log(
      title,
      schema.parse({
        ...process.env,
        PGSTREAM_POSTGRES_LISTENER_URL: buildConnectionString(listenerUrl, { mask: true }),
        PGSTREAM_POSTGRES_WRITER_TARGET_URL: buildConnectionString(writerTargetUrl, { mask: true }),
        PGSTREAM_POSTGRES_SNAPSHOT_STORE_URL: buildConnectionString(snapshotStoreUrl, { mask: true }),
        PGSTREAM_POSTGRES_WRITER_SCHEMALOG_STORE_URL: buildConnectionString(listenerUrl, { mask: true }),
        PGSTREAM_INJECTOR_STORE_POSTGRES_URL: buildConnectionString(listenerUrl, { mask: true })
      })
    );
  }
}

function getRoleEnvDefaults(copyRoles: boolean): {
  rolesMode: 'no_passwords' | 'disabled';
  noOwner: 'true' | 'false';
  noPrivileges: 'true' | 'false';
} {
  return {
    rolesMode: copyRoles ? 'no_passwords' : 'disabled',
    noOwner: copyRoles ? 'false' : 'true',
    noPrivileges: copyRoles ? 'false' : 'true'
  };
}

export function getPgStreamStartEnv(
  context: LocalContext,
  sourceUrl: string,
  targetUrl: string,
  filterTables: string,
  role?: string,
  copyRoles = false
) {
  const { rolesMode, noOwner, noPrivileges } = getRoleEnvDefaults(copyRoles);

  const schema = z.object({
    PGSTREAM_POSTGRES_LISTENER_URL: z.string().default(sourceUrl),
    PGSTREAM_POSTGRES_SNAPSHOT_TABLES: z.string().default(filterTables),
    PGSTREAM_POSTGRES_WRITER_TARGET_URL: z.string().default(targetUrl),
    PGSTREAM_POSTGRES_SNAPSHOT_STORE_URL: z.string().default(targetUrl),
    PGSTREAM_POSTGRES_SNAPSHOT_STORE_REPEATABLE: z.string().default('true'),
    PGSTREAM_POSTGRES_SNAPSHOT_CLEAN_TARGET_DB: z.string().default('true'),
    PGSTREAM_POSTGRES_SNAPSHOT_ROLES_SNAPSHOT_MODE: z.string().default(rolesMode),
    PGSTREAM_POSTGRES_SNAPSHOT_NO_OWNER: z.string().default(noOwner),
    PGSTREAM_POSTGRES_SNAPSHOT_NO_PRIVILEGES: z.string().default(noPrivileges),
    PGSTREAM_POSTGRES_WRITER_ON_CONFLICT_ACTION: z.string().default('error'),
    PGSTREAM_POSTGRES_WRITER_DISABLE_TRIGGERS: z.string().default('true'),
    PGSTREAM_TRANSFORMER_RULES_FILE: doesCloneYamlFileExist(context)
      ? z.string().default(DEFAULT_CLONE_RULES_FILE)
      : z.string().optional(),
    PGSTREAM_POSTGRES_SNAPSHOT_ROLE: role ? z.string().default(role) : z.string().optional()
  });
  logPgStreamEnv(context, 'PGStream Start Environment Variables:', schema, sourceUrl, targetUrl, targetUrl);
  return schema.parse(process.env);
}

export function getPgStreamStreamEnv(
  context: LocalContext,
  sourceUrl: string,
  targetUrl: string,
  filterTables: string,
  role?: string,
  copyRoles = false,
  skipDdlTracking = false
) {
  const { rolesMode, noOwner, noPrivileges } = getRoleEnvDefaults(copyRoles);

  const schema = z.object({
    PGSTREAM_POSTGRES_LISTENER_URL: z.string().default(sourceUrl),
    PGSTREAM_POSTGRES_SNAPSHOT_TABLES: z.string().default(filterTables),
    PGSTREAM_POSTGRES_SNAPSHOT_EXCLUDED_TABLES: z.string().default('pgstream.*'),
    PGSTREAM_POSTGRES_WRITER_TARGET_URL: z.string().default(targetUrl),
    PGSTREAM_POSTGRES_SNAPSHOT_STORE_URL: z.string().default(sourceUrl),
    PGSTREAM_POSTGRES_WRITER_SCHEMALOG_STORE_URL: skipDdlTracking
      ? z.string().optional()
      : z.string().default(sourceUrl),
    PGSTREAM_INJECTOR_STORE_POSTGRES_URL: z.string().default(sourceUrl),
    PGSTREAM_POSTGRES_SNAPSHOT_STORE_REPEATABLE: z.string().default('false'),
    PGSTREAM_POSTGRES_SNAPSHOT_CLEAN_TARGET_DB: z.string().default('true'),
    PGSTREAM_POSTGRES_SNAPSHOT_ROLES_SNAPSHOT_MODE: z.string().default(rolesMode),
    PGSTREAM_POSTGRES_SNAPSHOT_NO_OWNER: z.string().default(noOwner),
    PGSTREAM_POSTGRES_SNAPSHOT_NO_PRIVILEGES: z.string().default(noPrivileges),
    PGSTREAM_POSTGRES_WRITER_ON_CONFLICT_ACTION: z.string().default('error'),
    PGSTREAM_POSTGRES_WRITER_DISABLE_TRIGGERS: z.string().default('true'),
    PGSTREAM_POSTGRES_WRITER_IGNORE_DDL: skipDdlTracking ? z.string().default('true') : z.string().optional(),
    PGSTREAM_TRANSFORMER_RULES_FILE: doesCloneYamlFileExist(context)
      ? z.string().default(DEFAULT_CLONE_RULES_FILE)
      : z.string().optional(),
    PGSTREAM_POSTGRES_SNAPSHOT_ROLE: role ? z.string().default(role) : z.string().optional()
  });
  logPgStreamEnv(context, 'PGStream Stream Environment Variables:', schema, sourceUrl, targetUrl, sourceUrl);
  return schema.parse(process.env);
}
