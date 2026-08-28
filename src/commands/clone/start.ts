import { buildCommand } from '@stricli/core';
import { buildConnectionString, fetchBranchConnectionString } from '@xata.io/sql';
import chalk from 'chalk';
import dedent from 'dedent';
import type { LocalContext } from '~/context';
import { checkBranchIsReachable } from '~/lib/binary/utils';

import { branchPathParams, type ContextFlags, contextFlags, exitWithError } from '~/lib/cli-utils';
import { CLI_NAME, DEFAULT_CLONE_RULES_FILE } from '~/lib/constants';
import { type CommandDetails, type LogLevel, type PgStreamOptions, runPgStream } from '~/lib/pgstream/commands';
import {
  type CommandFlags,
  convertGlobalFlagsToRuntimeFlags,
  getCommandFlags,
  type GlobalFlags
} from '~/lib/pgstream/stream-utils';
import { readConfigFile } from './clone-config-utils';
import type { ValidationMode } from './config';
import { getPgStreamStartEnv } from './env';
import { applyTargetDatabaseTuning, revertTargetDatabaseTuning, type TargetTuning } from './target-tuning';
import { debugDump } from '~/lib/debug';

const COMMAND = 'snapshot';
type CommandType = 'snapshot';
const commandFlags = getCommandFlags(COMMAND);

type Flags = ContextFlags & {
  'filter-tables': string;
  'validation-mode': ValidationMode | 'prompt';
  role?: string;
  'log-level'?: LogLevel;
  'copy-roles': boolean;
  'tune-target': boolean;
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

const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 } as const;
const INTERRUPT_SIGNALS = Object.keys(SIGNAL_EXIT_CODES) as (keyof typeof SIGNAL_EXIT_CODES)[];

function listenForInterrupts(context: LocalContext, handle: (signal: keyof typeof SIGNAL_EXIT_CODES) => void) {
  for (const signal of INTERRUPT_SIGNALS) {
    context.process.on(signal, handle);
  }
  return () => {
    for (const signal of INTERRUPT_SIGNALS) {
      context.process.off(signal, handle);
    }
  };
}

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
    debugDump(`${COMMAND}`, { args, flags });
  }
  const target = await checkBranchIsReachable(this, flags);

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
    debugDump(`${COMMAND}`, { runtimeFlags });
  }

  const interruption = new AbortController();
  let interruptedBy: keyof typeof SIGNAL_EXIT_CODES | undefined;

  const stopListening = flags['tune-target']
    ? listenForInterrupts(this, (signal) => {
        interruptedBy = signal;
        this.process.stderr.write(
          chalk.yellow(`\nStopping the clone (${signal}) and reverting the tuning. Interrupt again to skip it.\n`)
        );
        interruption.abort();
      })
    : undefined;

  let tuning: TargetTuning | undefined;
  try {
    tuning = flags['tune-target'] ? await applyTargetDatabaseTuning(this, target) : undefined;

    const connectionString = await fetchBranchConnectionString(this.api, branchPathParams(target), {
      database: target.database
    });
    const connectionStringWithPgrollInternalGUC = buildConnectionString(connectionString, {
      pgrollInternalGUC: true
    });
    const safeConnectionString = buildConnectionString(connectionString, { mask: true });

    const env = getPgStreamStartEnv(
      this,
      sourceUrl,
      connectionStringWithPgrollInternalGUC,
      flags['filter-tables'],
      flags.role,
      flags['copy-roles'],
      tuning
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
        args: args,
        signal: interruption.signal
      },
      flags['log-level']
    );
    if (!success && !interruptedBy) {
      throw new Error(`Error: pgstream binary execution failed with exit code ${exitCode}`);
    }
  } finally {
    stopListening?.();
    if (tuning) {
      await revertTargetDatabaseTuning(this, tuning);
    }
  }

  if (interruptedBy) {
    this.process.exitCode = SIGNAL_EXIT_CODES[interruptedBy];
  }
}

export const CloneStartCommand = buildCommand({
  docs: {
    brief: 'Snapshot a PostgreSQL database into a Xata branch',
    fullDescription:
      'Copies the source database into the branch once. The anonymization rules in `.xata/clone.yaml` are applied on the way in, and strict validation refuses to run until every table and column is covered by them.'
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
      ...contextFlags,
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
      },
      'tune-target': {
        kind: 'boolean',
        brief:
          'Temporarily tune the target branch for bulk loading, reverting the change when the clone stops. Raises max_wal_size on the branch and the maintenance settings on the index rebuild.',
        default: false
      }
    }
  },
  func: implementation
});
