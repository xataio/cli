import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { checkBranchIsReachable } from '~/lib/binary/utils';
import type { ContextFlags } from '~/lib/cli-utils';
import { type CommandDetails, runPgRoll } from '~/lib/pgroll/commands';
import {
  type CommandFlags,
  convertGlobalFlagsToRuntimeFlags,
  getCommandDefinition,
  getCommandFlags,
  type GlobalFlags
} from '~/lib/pgroll/roll-utils';
import { debugDump } from '~/lib/debug';

const COMMAND = 'status';
type CommandType = 'status';
const commandDefinition = getCommandDefinition(COMMAND);
const commandFlags = getCommandFlags(COMMAND);

type Flags = ContextFlags & GlobalFlags & CommandFlags<CommandType>;

export async function implementation(
  this: LocalContext,
  flags: Flags,
  ...args: string[] & { length: CommandDetails<CommandType>['args']['length'] }
) {
  if (this.debug) {
    debugDump(`${COMMAND}`, { args, flags });
  }
  const target = await checkBranchIsReachable(this, flags);
  const runtimeFlags = convertGlobalFlagsToRuntimeFlags<CommandType>(flags);
  if (this.debug) {
    debugDump(`${COMMAND}`, { runtimeFlags });
  }

  const { success, exitCode } = await runPgRoll<CommandType>(this, COMMAND, { flags: runtimeFlags, args }, target);
  if (!success) {
    throw new Error(`Error: pgroll binary execution failed with exit code ${exitCode}`);
  }
}

export const RollStatusCommand = buildCommand({
  docs: {
    brief: commandDefinition?.short || '??'
  },
  parameters: {
    // @ts-expect-error fix types
    flags: commandFlags
  },
  func: implementation
});
