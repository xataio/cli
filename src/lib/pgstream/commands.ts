import type { Definition } from '@xata.io/pgstream';
import type { LocalContext } from '~/context';
import { getPgStream } from './binary';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'panic';

export type PgStreamCommands = (typeof Definition.commands)[number]['name'];
type GlobalFlags = (typeof Definition.flags)[number]['name'];

type GlobalFlagsType = `--${GlobalFlags}` | `--${GlobalFlags}=${string}`;

export type CommandDetails<Command extends PgStreamCommands> = Extract<
  (typeof Definition.commands)[number],
  { name: Command }
>;

export type CommandFlags<Command extends PgStreamCommands> = CommandDetails<Command>['flags'] extends readonly {
  name: infer Name extends string;
}[]
  ? `--${Name}` | `--${Name}=${string}`
  : never;

type CommandArgs<Command extends PgStreamCommands> = CommandDetails<Command>['args'] extends readonly string[]
  ? string[] & { length: CommandDetails<Command>['args']['length'] }
  : never;

export type PgStreamOptions<Command extends PgStreamCommands> = {
  args?: CommandArgs<Command>;
  flags?: Array<CommandFlags<Command> | GlobalFlagsType>;
  captureOutput?: boolean;
  signal?: AbortSignal;
};

type PgStreamResultBase = {
  success: boolean;
  exitCode: number;
};

type PgStreamResultWithOutput = PgStreamResultBase & {
  stdout: string;
  stderr: string;
};

export async function runPgStream<Command extends PgStreamCommands>(
  context: LocalContext,
  command: Command | [Command, ...string[]],
  env: Record<string, string | undefined> | undefined,
  options: PgStreamOptions<Command> & { captureOutput: true },
  logLevel?: LogLevel
): Promise<PgStreamResultWithOutput>;

export async function runPgStream<Command extends PgStreamCommands>(
  context: LocalContext,
  command: Command | [Command, ...string[]],
  env: Record<string, string | undefined> | undefined,
  options?: PgStreamOptions<Command>,
  logLevel?: LogLevel
): Promise<PgStreamResultBase>;

export async function runPgStream<Command extends PgStreamCommands>(
  context: LocalContext,
  command: Command | [Command, ...string[]],
  env: Record<string, string | undefined> | undefined,
  options: PgStreamOptions<Command> = {},
  logLevel: LogLevel = 'info'
): Promise<PgStreamResultBase | PgStreamResultWithOutput> {
  const { flags = [], args = [], captureOutput = false, signal } = options;
  const binary = await getPgStream(context);

  const commandParts = Array.isArray(command) ? command : [command];

  const proc = Bun.spawn([binary, ...commandParts, '--log-level', logLevel, ...flags, ...args], {
    env: { ...env, ...Bun.env },
    stdout: captureOutput ? 'pipe' : 'inherit',
    stderr: captureOutput ? 'pipe' : 'inherit'
  });

  const interrupt = () => proc.kill('SIGINT');
  if (signal?.aborted) {
    interrupt();
  }
  signal?.addEventListener('abort', interrupt, { once: true });

  try {
    if (captureOutput) {
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited
      ]);

      return {
        success: exitCode === 0,
        exitCode,
        stdout,
        stderr
      };
    }

    const exitCode = await proc.exited;
    return {
      success: exitCode === 0,
      exitCode
    };
  } finally {
    signal?.removeEventListener('abort', interrupt);
  }
}
