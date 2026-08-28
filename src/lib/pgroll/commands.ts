import type { Definition } from '@xata.io/pgroll';
import { buildConnectionString, fetchBranchConnectionString } from '@xata.io/sql';
import chalk from 'chalk';
import dedent from 'dedent';
import type { LocalContext } from '~/context';
import { getCurrentVersion } from '../binary/utils';
import { branchPathParams, type ResolvedContext } from '../cli-utils';
import { getPgRoll } from './binary';

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
  options: PgRollOptions<Command>,
  target: ResolvedContext
): Promise<{
  success: boolean;
  exitCode: number;
}> {
  const { flags = [], args = [] } = options;

  const binary = await getPgRoll(context);

  // An explicit Postgres URL wins over the branch we resolved, pgroll reads both.
  if (!Bun.env.PGROLL_PG_URL && !flags.some((flag) => flag.startsWith('--postgres-url'))) {
    const connectionString = await fetchBranchConnectionString(context.api, branchPathParams(target), {
      database: target.database
    });
    Bun.env.PGROLL_PG_URL = connectionString;
    if (context.debug) {
      context.process.stdout.write(`DEBUG: Using ${buildConnectionString(connectionString, { mask: true })}\n`);
    }
  }

  const proc = Bun.spawn([binary, command, ...flags, ...args], {
    env: Bun.env,
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: Bun.stdin
  });

  const exitCode = await proc.exited;

  const postgresUrl = Bun.env.PGROLL_PG_URL;
  if (exitCode !== 0 && postgresUrl) {
    await checkVersionMismatch(context, postgresUrl, options.flags);
  }

  return {
    success: exitCode === 0,
    exitCode
  };
}

async function checkVersionMismatch(
  context: LocalContext,
  postgresUrl: string,
  flags?: readonly string[]
): Promise<void> {
  try {
    const binaryVersion = await getCurrentVersion('pgroll');
    if (!binaryVersion) return;

    const pgrollSchema = flags?.find((f) => f.startsWith('--pgroll-schema='))?.split('=')[1] ?? 'pgroll';

    const sql = context.postgres(postgresUrl);
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
