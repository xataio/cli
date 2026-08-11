import { buildCommand } from '@stricli/core';
import { buildConnectionString, fetchBranchConnectionString } from '@xata.io/sql';
import chalk from 'chalk';
import dedent from 'dedent';
import invariant from 'tiny-invariant';
import type { LocalContext } from '~/context';
import { checkBranchIsReachable } from '~/lib/binary/utils';

import { branchConfig } from '~/lib/branch-config';
import { isCLIConfigInitialized } from '~/lib/cli-config';
import { CLI_NAME, DEFAULT_CLONE_RULES_FILE } from '~/lib/constants';
import { type CommandDetails, type LogLevel, type PgStreamOptions, runPgStream } from '~/lib/pgstream/commands';
import {
  type CommandFlags,
  convertGlobalFlagsToRuntimeFlags,
  getCommandDefinition,
  getCommandFlags,
  type GlobalFlags
} from '~/lib/pgstream/stream-utils';
import { projectConfig } from '~/lib/project-config';
import { readConfigFile } from './clone-config-utils';
import type { ValidationMode } from './config';
import { getPgStreamStartEnv } from './env';

const COMMAND = 'snapshot';
type CommandType = 'snapshot';
const commandDefinition = getCommandDefinition(COMMAND);
const commandFlags = getCommandFlags(COMMAND);

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  database?: string;
  'filter-tables': string;
  'validation-mode': ValidationMode | 'prompt';
  role?: string;
  'log-level'?: LogLevel;
  'copy-roles': boolean;
} & GlobalFlags &
  CommandFlags<CommandType> & {
    'source-url': string;
  };

export function doesCloneYamlFileExist(context: LocalContext) {
  if (!context.fs.existsSync(DEFAULT_CLONE_RULES_FILE)) {
    return false;
  }
  return true;
}

export function getSourceUrl(context: LocalContext, flags: Pick<Flags, 'source-url'>) {
  const sourceUrl = flags['source-url'] || context.env.XATA_CLI_SOURCE_POSTGRES_URL;
  invariant(
    sourceUrl,
    'Source PostgreSQL URL is required, please use --source-url flag or XATA_CLI_SOURCE_POSTGRES_URL environment variable'
  );
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
  await checkBranchIsReachable(this, flags);

  let validationMode: ValidationMode = 'strict';
  if (flags['validation-mode'] === 'prompt') {
    const validationModeResult = (await this.enquirer.selectPrompt(
      this.isInteractive,
      'Do you want to anonymize data?',
      [
        { name: 'strict', message: 'Yes' },
        { name: 'relaxed', message: 'No' }
      ]
    )) as ValidationMode;
    if (validationModeResult) {
      validationMode = validationModeResult;
    }
  } else {
    validationMode = flags['validation-mode'];
  }

  if (validationMode === 'strict' && !doesCloneYamlFileExist(this)) {
    throw new Error(
      dedent(
        `File ${DEFAULT_CLONE_RULES_FILE} does not exist. ${chalk.bold(`${CLI_NAME} clone start`)} command only works when a clone.yaml file is present.
            Please use ${chalk.bold(`${CLI_NAME} clone config`)} command set up a new clone.yaml file.
            `
      )
    );
  }
  if (validationMode === 'strict') {
    const cloneConfigJson = readConfigFile(this);
    const validationMode = cloneConfigJson?.transformations?.validation_mode;
    if (validationMode !== 'strict') {
      throw new Error(
        `${chalk.bold(`${CLI_NAME} clone start`)} started in strict mode but the ${DEFAULT_CLONE_RULES_FILE} contains relaxed mode.`
      );
    }
  }

  const runtimeFlags: NonNullable<PgStreamOptions<CommandType>['flags']> =
    convertGlobalFlagsToRuntimeFlags<CommandType>(flags);
  if (this.debug) {
    console.log(`DEBUG: ${COMMAND}`, { runtimeFlags });
  }

  if (isCLIConfigInitialized(this)) {
    const databaseName = await this.getDatabase(this, flags);
    const connectionString = await fetchBranchConnectionString(
      this.api,
      {
        organizationID: projectConfig.organizationId,
        projectID: projectConfig.projectId,
        branchID: branchConfig.branchId
      },
      { database: databaseName }
    );
    const connectionStringWithPgrollInternalGUC = buildConnectionString(connectionString, { pgrollInternalGUC: true });
    const safeConnectionString = buildConnectionString(connectionString, { mask: true });

    const env = getPgStreamStartEnv(
      this,
      sourceUrl,
      connectionStringWithPgrollInternalGUC,
      flags['filter-tables'],
      flags.role,
      flags['copy-roles']
    );

    if (this.debug) {
      this.process.stdout.write(`DEBUG: Using ${safeConnectionString}\n`);
    }

    const { success, exitCode } = await runPgStream<CommandType>(
      this,
      COMMAND,
      env,
      {
        flags: runtimeFlags,
        args: args
      },
      flags['log-level']
    );
    if (!success) {
      throw new Error(`Error: pgstream binary execution failed with exit code ${exitCode}`);
    }
  } else {
    throw new Error(
      dedent`
      ${CLI_NAME} clone start command only works when using a config file based project.
      Please use ${chalk.bold(`${CLI_NAME} init`)} command to initialize a new project.
      `
    );
  }
}

export const CloneStartCommand = buildCommand({
  docs: {
    brief: commandDefinition?.short || '??'
  },
  parameters: {
    // @ts-expect-error fix types
    flags: {
      ...commandFlags,
      'source-url': {
        kind: 'parsed',
        parse: String,
        brief: 'The source URL of the database to clone',
        optional: false
      },
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
      },
      project: {
        kind: 'parsed',
        brief: 'Project ID',
        parse: String,
        optional: true
      },
      branch: {
        kind: 'parsed',
        brief: 'Branch ID',
        parse: String,
        optional: true
      },
      database: {
        kind: 'parsed',
        brief: 'Target database name on the checked-out Xata branch',
        parse: String,
        optional: true
      },
      'filter-tables': {
        kind: 'parsed',
        brief: 'Tables to filter',
        parse: String,
        default: '*.*'
      },
      'validation-mode': {
        kind: 'enum',
        values: ['strict', 'relaxed', 'prompt'],
        brief: 'Anonymization validation mode, strict implies that all tables and columns should be specified',
        default: 'prompt'
      },
      role: {
        kind: 'parsed',
        brief: 'Postgres role to use for the clone',
        parse: String,
        optional: true
      },
      'log-level': {
        kind: 'enum',
        values: ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'panic'],
        brief: 'Log level for pgstream',
        default: 'info'
      },
      'copy-roles': {
        kind: 'boolean',
        brief: 'Copy roles, owners, and privileges to the target',
        default: false
      }
    }
  },
  func: implementation
});
