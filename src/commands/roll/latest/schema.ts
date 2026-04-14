import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { checkBranchIsReachable } from '~/lib/binary/utils';
import { type CommandDetails, runPgRoll } from '~/lib/pgroll/commands';
import {
  convertGlobalFlagsToRuntimeFlags,
  getCommandFlags,
  getSubCommandDefinition,
  type GlobalFlags,
  type SubcommandFlags
} from '~/lib/pgroll/roll-utils';

const COMMAND = 'latest';
const SUBCOMMAND = 'schema';
type CommandType = 'latest';
const subCommandDefinition = getSubCommandDefinition<CommandType>(COMMAND, 'schema');
const commandFlags = getCommandFlags(COMMAND, SUBCOMMAND);

type Flags = {
  organization: string;
  project: string;
  branch: string;
} & GlobalFlags &
  SubcommandFlags<CommandType, 'schema'>;

export async function implementation(
  this: LocalContext,
  flags: Flags,
  ...args: string[] & { length: CommandDetails<CommandType>['args']['length'] }
) {
  if (this.debug) {
    console.log(`DEBUG: ${COMMAND} ${SUBCOMMAND}`, { args, flags });
  }
  await checkBranchIsReachable(this, flags);

  const runtimeFlags = convertGlobalFlagsToRuntimeFlags<CommandType>(flags);

  if (flags.local) {
    runtimeFlags.push(`--local=${flags.local}`);
  }

  if (this.debug) {
    console.log(`DEBUG: ${COMMAND} ${SUBCOMMAND}`, { runtimeFlags });
  }
  const { success, exitCode } = await runPgRoll<CommandType>(this, COMMAND, {
    flags: runtimeFlags,
    //@ts-expect-error fix sub-command
    args: [SUBCOMMAND, ...args]
  });
  if (!success) {
    throw new Error(`Error: pgroll binary execution failed with exit code ${exitCode}`);
  }
}

export const RollLatestSchemaCommand = buildCommand({
  docs: {
    brief: subCommandDefinition?.short || 'Print the latest schema version (migration name prefixed with schema)'
  },
  parameters: {
    // @ts-expect-error fix types
    flags: commandFlags
  },
  func: implementation
});
