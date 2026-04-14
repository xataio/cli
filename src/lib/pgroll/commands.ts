import type { Definition } from '@xata.io/pgroll';
import { buildConnectionString } from '@xata.io/sql';
import chalk from 'chalk';
import dedent from 'dedent';
import type { LocalContext } from '~/context';
import { getCurrentVersion } from '../binary/utils';
import { branchConfig } from '../branch-config';
import { isCLIConfigInitialized } from '../cli-config';
import { projectConfig } from '../project-config';
import { getPgRoll } from './binary';
import invariant from 'tiny-invariant';

export type PgRollCommands = (typeof Definition.commands)[number]['name'];
export type PgRollSubCommands<Command extends PgRollCommands> = CommandDetails<Command>['subcommands'][number]['name'];

type GlobalFlags = (typeof Definition.flags)[number]['name'];

type GlobalFlagsType = `--${GlobalFlags}` | `--${GlobalFlags}=${string}`;

export type CommandDetails<Command extends PgRollCommands> = Extract<
  (typeof Definition.commands)[number],
  { name: Command }
>;

export type CommandFlags<Command extends PgRollCommands> = CommandDetails<Command>['flags'] extends readonly {
  name: infer Name extends string;
}[]
  ? `--${Name}` | `--${Name}=${string}`
  : never;

type CommandArgs<Command extends PgRollCommands> = CommandDetails<Command>['args'] extends readonly string[]
  ? string[] & { length: CommandDetails<Command>['args']['length'] }
  : never;

export type PgRollOptions<Command extends PgRollCommands> = {
  args: CommandArgs<Command>;
  flags?: Array<CommandFlags<Command> | GlobalFlagsType>;
};

export async function runPgRoll<Command extends PgRollCommands>(
  context: LocalContext,
  command: Command,
  options: PgRollOptions<Command>
): Promise<{
  success: boolean;
  exitCode: number;
}> {
  const { flags = [], args = [] } = options;

  const binary = await getPgRoll(context);

  if (isCLIConfigInitialized(context)) {
    const branch = await context.api.branches.describeBranch({
      pathParams: {
        organizationID: projectConfig.organizationId,
        projectID: projectConfig.projectId,
        branchID: branchConfig.branchId
      }
    });
    const databaseName = branchConfig.databaseName;
    invariant(branch.connectionString, 'Branch should have a connection string at this point.');
    const connectionString = buildConnectionString(branch.connectionString, { database: databaseName });
    const safeConnectionString = buildConnectionString(connectionString, { mask: true });
    Bun.env.PGROLL_PG_URL = connectionString;
    if (context.debug) {
      context.process.stdout.write(`DEBUG: Using ${safeConnectionString}\n`);
    }
  }

  const proc = Bun.spawn([binary, command, ...flags, ...args], {
    env: Bun.env,
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: Bun.stdin
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0 && Bun.env.PGROLL_PG_URL) {
    await checkVersionMismatch(context, options.flags);
  }

  return {
    success: exitCode === 0,
    exitCode
  };
}

async function checkVersionMismatch(context: LocalContext, flags?: readonly string[]): Promise<void> {
  try {
    const binaryVersion = await getCurrentVersion('pgroll');
    if (!binaryVersion) return;

    const pgrollSchema = flags?.find((f) => f.startsWith('--pgroll-schema='))?.split('=')[1] ?? 'pgroll';

    const sql = context.postgres(Bun.env.PGROLL_PG_URL!);
    try {
      const result =
        await sql`SELECT version FROM ${sql(pgrollSchema)}.pgroll_version ORDER BY initialized_at DESC LIMIT 1`;
      const schemaVersion = result[0]?.version;
      if (!schemaVersion) return;

      // Only warn when schema is newer than binary (matches pgroll's VersionCompatVersionSchemaNewer logic)
      if (!isVersionNewer(schemaVersion, binaryVersion)) return;

      context.process.stderr.write(
        `${chalk.yellow(
          dedent(`\n
            Hint: pgroll schema version (${schemaVersion}) is newer than the binary in use (${binaryVersion}).
            To use a matching binary, set the environment variable XATA_PGROLL_BINARY_VERSION and rerun, e.g.:
              XATA_PGROLL_BINARY_VERSION=${schemaVersion} xata roll <command>
          `)
        )}\n`
      );
    } finally {
      await sql.end();
    }
  } catch {
    // Best-effort check, don't fail if we can't query the database
  }
}

/** Returns true if version `a` is strictly newer than version `b` (semver major.minor.patch comparison). */
export function isVersionNewer(a: string, b: string): boolean {
  const parse = (v: string) => {
    const parts = v.replace(/^v/, '').split('.').map(Number);
    if (parts.length < 3 || parts.some(Number.isNaN)) return null;
    return parts as [number, number, number];
  };
  const av = parse(a);
  const bv = parse(b);
  if (!av || !bv) return false;
  if (av[0] !== bv[0]) return av[0] > bv[0];
  if (av[1] !== bv[1]) return av[1] > bv[1];
  return av[2] > bv[2];
}
