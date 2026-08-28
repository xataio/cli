import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { exitWithError } from '~/lib/cli-utils';
import { type CommandDetails, type LogLevel, type PgStreamOptions, runPgStream } from '~/lib/pgstream/commands';
import {
  type CommandFlags,
  convertGlobalFlagsToRuntimeFlags,
  getCommandFlags,
  type GlobalFlags
} from '~/lib/pgstream/stream-utils';

const COMMAND = 'destroy';
type CommandType = 'destroy';
const commandFlags = getCommandFlags(COMMAND);

type Flags = {
  'log-level'?: LogLevel;
} & GlobalFlags &
  CommandFlags<CommandType> & {
    'source-url': string;
  };

export function getSourceUrl(context: LocalContext, flags: Pick<Flags, 'source-url'>) {
  const sourceUrl = flags['source-url'] || context.env.XATA_CLI_SOURCE_POSTGRES_URL;
  if (!sourceUrl) {
    return exitWithError(
      context,
      'No source database given. Pass --source-url <url> or set XATA_CLI_SOURCE_POSTGRES_URL.'
    );
  }
  return sourceUrl;
}

export async function implementation(
  this: LocalContext,
  flags: Flags,
  ...args: string[] & { length: CommandDetails<CommandType>['args']['length'] }
) {
  const sourceUrl = getSourceUrl(this, flags);

  if (this.debug) {
    console.log(`DEBUG: ${COMMAND}`, { args, flags });
  }

  const runtimeFlags: NonNullable<PgStreamOptions<CommandType>['flags']> =
    convertGlobalFlagsToRuntimeFlags<CommandType>(flags);
  if (this.debug) {
    console.log(`DEBUG: ${COMMAND}`, { runtimeFlags });
  }

  runtimeFlags.push(`--postgres-url=${sourceUrl}`);
  const { success, exitCode } = await runPgStream<CommandType>(
    this,
    COMMAND,
    undefined,
    {
      flags: runtimeFlags,
      args: args
    },
    flags['log-level']
  );
  if (!success) {
    throw new Error(`Error: pgstream binary execution failed with exit code ${exitCode}`);
  }
}

export const StreamDestroyCommand = buildCommand({
  docs: {
    brief: 'Remove the pgstream setup from a source database',
    fullDescription:
      'Drops the replication slot along with the tables, functions and triggers pgstream created, and the pgstream schema itself.'
  },
  parameters: {
    // @ts-expect-error fix types
    flags: {
      ...commandFlags,
      'source-url': {
        kind: 'parsed',
        parse: String,
        brief: 'The source PostgreSQL URL',
        optional: false
      },
      'log-level': {
        kind: 'enum',
        values: ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'panic'],
        brief: 'Log level for pgstream',
        default: 'info'
      }
    }
  },
  func: implementation
});
