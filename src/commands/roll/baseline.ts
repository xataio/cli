import { buildCommand } from '@stricli/core';
import invariant from 'tiny-invariant';
import type { LocalContext } from '~/context';
import { checkBranchIsReachable } from '~/lib/binary/utils';
import { type ContextFlags, exitWithError } from '~/lib/cli-utils';
import { DEFAULT_MIGRATIONS_DIRECTORY } from '~/lib/constants';
import { type CommandDetails, runPgRoll } from '~/lib/pgroll/commands';
import {
  type CommandFlags,
  convertGlobalFlagsToRuntimeFlags,
  getCommandDefinition,
  getCommandFlags,
  type GlobalFlags
} from '~/lib/pgroll/roll-utils';
import { debugDump } from '~/lib/debug';

const COMMAND = 'baseline';
type CommandType = 'baseline';
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

  const targetDir = args[1];
  invariant(targetDir, 'Target directory is required');
  const target = await checkBranchIsReachable(this, flags);

  let migrationName = args[0];
  if (!migrationName) {
    migrationName = await this.enquirer.inputPrompt(this.isInteractive, 'Please enter the name of the migration', {
      placeholder: '01_initial_migration'
    });
  }
  if (!migrationName) {
    return exitWithError(this, 'No migration name given. Pass it as an argument, for example `01_initial_schema`.');
  }

  const runtimeFlags = convertGlobalFlagsToRuntimeFlags<CommandType>(flags);

  if (this.debug) {
    debugDump(`${COMMAND}`, { runtimeFlags });
  }

  const { success, exitCode } = await runPgRoll<CommandType>(this, COMMAND, { flags: runtimeFlags, args }, target);
  if (!success) {
    throw new Error(`Error: pgroll binary execution failed with exit code ${exitCode}`);
  }
}

export const RollBaselineCommand = buildCommand({
  docs: {
    brief: commandDefinition?.short || '??'
  },
  parameters: {
    // @ts-expect-error fix types
    flags: commandFlags,
    positional: {
      kind: 'tuple',
      // @ts-expect-error fix types
      parameters: [
        {
          brief: 'Version name for the baseline, for example 01_initial_schema',
          placeholder: 'version',
          parse: String,
          default: ''
        },
        {
          brief: 'The directory that contains the migrations',
          placeholder: 'folder',
          parse: String,
          default: DEFAULT_MIGRATIONS_DIRECTORY
        }
      ] as const
    }
  },
  func: implementation
});
