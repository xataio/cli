import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { checkBranchIsReachable } from '~/lib/binary/utils';
import type { ContextFlags } from '~/lib/cli-utils';
import { type CommandDetails, runPgRoll } from '~/lib/pgroll/commands';
import {
  convertGlobalFlagsToRuntimeFlags,
  getCommandFlags,
  getSubCommandDefinition,
  type GlobalFlags,
  type SubcommandFlags
} from '~/lib/pgroll/roll-utils';
import { debugDump } from '~/lib/debug';

const COMMAND = 'latest';
const SUBCOMMAND = 'migration';
type CommandType = 'latest';
const subCommandDefinition = getSubCommandDefinition<CommandType>(COMMAND, 'migration');
const commandFlags = getCommandFlags(COMMAND, SUBCOMMAND);

type Flags = ContextFlags & GlobalFlags & SubcommandFlags<CommandType, 'migration'>;

export async function implementation(
  this: LocalContext,
  flags: Flags,
  ...args: string[] & { length: CommandDetails<CommandType>['args']['length'] }
) {
  if (this.debug) {
    debugDump(`${COMMAND} ${SUBCOMMAND}`, { args, flags });
  }
  const target = await checkBranchIsReachable(this, flags);

  const runtimeFlags = convertGlobalFlagsToRuntimeFlags<CommandType>(flags);

  if (flags.local) {
    runtimeFlags.push(`--local=${flags.local}`);
  }

  if (this.debug) {
    debugDump(`${COMMAND} ${SUBCOMMAND}`, { runtimeFlags });
  }
  const { success, exitCode } = await runPgRoll<CommandType>(
    this,
    COMMAND,
    {
      flags: runtimeFlags,
      //@ts-expect-error fix sub-command
      args: [SUBCOMMAND, ...args]
    },
    target
  );
  if (!success) {
    throw new Error(`Error: pgroll binary execution failed with exit code ${exitCode}`);
  }
}

export const RollLatestMigrationCommand = buildCommand({
  docs: {
    brief: subCommandDefinition?.short || 'Print the latest migration name (without schema prefix)'
  },
  parameters: {
    // @ts-expect-error fix types
    flags: commandFlags
  },
  func: implementation
});
