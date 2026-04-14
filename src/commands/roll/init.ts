import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { checkBranchIsReachable } from '~/lib/binary/utils';
import { type CommandDetails, runPgRoll } from '~/lib/pgroll/commands';
import {
  type CommandFlags,
  convertGlobalFlagsToRuntimeFlags,
  getCommandDefinition,
  getCommandFlags,
  type GlobalFlags
} from '~/lib/pgroll/roll-utils';

const COMMAND = 'init';
type CommandType = 'init';
const commandDefinition = getCommandDefinition(COMMAND);
const commandFlags = getCommandFlags(COMMAND);

type Flags = {
  organization: string;
  project: string;
  branch: string;
} & GlobalFlags &
  CommandFlags<CommandType>;

export async function implementation(
  this: LocalContext,
  flags: Flags,
  ...args: string[] & { length: CommandDetails<CommandType>['args']['length'] }
) {
  if (this.debug) {
    console.log(`DEBUG: ${COMMAND}`, { args, flags });
  }
  await checkBranchIsReachable(this, flags);

  const runtimeFlags = convertGlobalFlagsToRuntimeFlags<CommandType>(flags);
  if (this.debug) {
    console.log(`DEBUG: ${COMMAND}`, { runtimeFlags });
  }
  const { success, exitCode } = await runPgRoll<CommandType>(this, COMMAND, {
    flags: runtimeFlags,
    args: args
  });
  if (!success) {
    throw new Error(`Error: pgroll binary execution failed with exit code ${exitCode}`);
  }
}

export const RollInitCommand = buildCommand({
  docs: {
    brief: commandDefinition?.short || '??'
  },
  parameters: {
    // @ts-expect-error fix types
    flags: commandFlags
  },
  func: implementation
});
