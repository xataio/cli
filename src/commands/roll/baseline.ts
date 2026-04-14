import { buildCommand } from '@stricli/core';
import invariant from 'tiny-invariant';
import type { LocalContext } from '~/context';
import { checkBranchIsReachable } from '~/lib/binary/utils';
import { DEFAULT_MIGRATIONS_DIRECTORY } from '~/lib/constants';
import { type CommandDetails, runPgRoll } from '~/lib/pgroll/commands';
import {
  type CommandFlags,
  convertGlobalFlagsToRuntimeFlags,
  getCommandDefinition,
  getCommandFlags,
  type GlobalFlags
} from '~/lib/pgroll/roll-utils';

const COMMAND = 'baseline';
type CommandType = 'baseline';
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

  const targetDir = args[1];
  invariant(targetDir, 'Target directory is required');
  await checkBranchIsReachable(this, flags);

  let migrationName = args[0];
  if (!migrationName) {
    migrationName = await this.enquirer.inputPrompt(this.isCI, 'Please enter the name of the migration', {
      placeholder: '01_initial_migration'
    });
  }
  invariant(migrationName, 'Migration name is required');

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
          brief: 'Name of the migration',
          placeholder: 'The version name for the baseline (e.g., "01_initial_schema")',
          parse: String,
          default: ''
        },
        {
          brief: 'The directory that contains the migrations',
          placeholder: 'folder to migrate',
          parse: String,
          default: DEFAULT_MIGRATIONS_DIRECTORY
        }
      ] as const
    }
  },
  func: implementation
});
