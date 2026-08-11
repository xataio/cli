import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import dedent from 'dedent';
import invariant from 'tiny-invariant';
import type { LocalContext } from '~/context';
import { checkBranchIsReachable } from '~/lib/binary/utils';
import { CLI_NAME, DEFAULT_MIGRATIONS_DIRECTORY } from '~/lib/constants';
import { type CommandDetails, runPgRoll } from '~/lib/pgroll/commands';
import {
  type CommandFlags,
  convertGlobalFlagsToRuntimeFlags,
  getCommandDefinition,
  getCommandFlags,
  type GlobalFlags
} from '~/lib/pgroll/roll-utils';

const COMMAND = 'migrate';
type CommandType = 'migrate';
const commandDefinition = getCommandDefinition(COMMAND);
const commandFlags = getCommandFlags(COMMAND);

type Flags = {
  organization: string;
  project: string;
  branch: string;
} & GlobalFlags &
  CommandFlags<CommandType>;

export function checkMigrationsDirectory(context: LocalContext, targetDir: string) {
  if (!context.fs.existsSync(targetDir)) {
    throw new Error(
      dedent(
        `Directory ${targetDir} does not exist. ${CLI_NAME} roll migrate command only works with config file based project.
        Please use ${chalk.bold(`${CLI_NAME} init`)} command to initialize a new project.
        
        If the project is already initialized, please check that the migrations directory is present. If you are already using \`pgroll\` you can run
        ${chalk.bold(`${CLI_NAME} roll pull`)} to pull the migrations from the remote database.
        `
      )
    );
  }
}

export async function implementation(
  this: LocalContext,
  flags: Flags,
  ...args: string[] & { length: CommandDetails<CommandType>['args']['length'] }
) {
  if (this.debug) {
    console.log(`DEBUG: ${COMMAND}`, { args, flags });
  }

  const targetDir = args[0];
  invariant(targetDir, 'Target directory is required');
  checkMigrationsDirectory(this, targetDir);
  await checkBranchIsReachable(this, flags);

  const runtimeFlags = convertGlobalFlagsToRuntimeFlags<CommandType>(flags);

  if (flags.complete) {
    runtimeFlags.push('--complete');
  }
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

export const RollMigrateCommand = buildCommand({
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
