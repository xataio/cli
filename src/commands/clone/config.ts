import { buildCommand } from '@stricli/core';
import invariant from 'tiny-invariant';
import type { LocalContext } from '~/context';
import { exitWithError, getErrorMessage } from '~/lib/cli-utils';

import { BUILD_SCHEMA_QUERY, type Schema } from '@xata.io/sql';
import { formatSchemaForAI, generateCloneConfig } from '@xata.io/ai';

import chalk from 'chalk';
import { env } from '~/lib/env';
import { stringify } from 'yaml';
import { checkBranchIsReachable } from '~/lib/binary/utils';
import { DEFAULT_CLONE_RULES_FILE } from '~/lib/constants';
import {
  type CloneConfigJson,
  EMPTY_CLONE_CONFIG_JSON,
  readConfigFile,
  sortCloneConfigForOutput,
  writeConfigFile
} from './clone-config-utils';
import { getSelectedColumnsViaPrompt } from './mode/prompts';
import { getSourceUrl } from './start';
import { getTransformsConfig } from './transforms';
import { validateCloneRulesWithPgstream, formatValidationErrorsForPrompt } from '~/lib/pgstream/validate-rules';
import { buildConnectionString } from '@xata.io/sql';
import { debugDump } from '~/lib/debug';

function writeSortedCloneConfig(context: LocalContext, config: Parameters<typeof sortCloneConfigForOutput>[0]) {
  const sorted = sortCloneConfigForOutput(config);
  const yaml = stringify(sorted);
  writeConfigFile(context, yaml);
}

/**
 * Fetches the full database schema
 * @throws Error if the query fails
 */
async function fetchDatabaseSchema(context: LocalContext, sourceUrl: string): Promise<Schema[]> {
  if (context.debug) {
    console.error(`DEBUG: Executing postgres query on ${buildConnectionString(sourceUrl, { mask: true })}`);
  }

  const sql = await context.postgres(sourceUrl);
  try {
    const result = await sql.unsafe<Schema[]>(BUILD_SCHEMA_QUERY);
    return result;
  } catch (error) {
    throw new Error(`Failed to fetch database schema: ${getErrorMessage(error)}`);
  } finally {
    await sql.end();
  }
}

export type ValidationMode = 'strict' | 'relaxed';

type Flags = {
  'source-url': string;
  mode: 'auto' | 'prompt' | 'web' | 'ai';
  'validation-mode': ValidationMode | 'prompt';
  organization?: string;
  project?: string;
  branch?: string;
  prompt?: string;
  model?: string;
};

export async function implementation(this: LocalContext, flags: Flags) {
  if (!this.isInteractive && flags.mode !== 'auto') {
    return exitWithError(this, 'Only --mode auto runs without a terminal, the other modes need one to prompt.');
  }
  await checkBranchIsReachable(this, flags);
  const sourceUrl = getSourceUrl(this, flags);
  if (this.debug) {
    invariant(sourceUrl, 'sourceUrl must be defined for debug logging');
    const maskedFlags = { ...flags, 'source-url': buildConnectionString(sourceUrl, { mask: true }) };
    debugDump(`xata clone config`, { flags: maskedFlags });
  }

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

  if (validationMode === 'relaxed') {
    const jsonTransformationsConfig = await getTransformsConfig(this, [], [], validationMode);
    writeSortedCloneConfig(this, jsonTransformationsConfig);
    return;
  }

  const fullSchemaJson = await fetchDatabaseSchema(this, sourceUrl);

  let selectedColumns: string[] = [];
  if (flags.mode === 'prompt') {
    let cloneConfigJson: CloneConfigJson = EMPTY_CLONE_CONFIG_JSON;
    if (this.fs.existsSync(DEFAULT_CLONE_RULES_FILE)) {
      cloneConfigJson = readConfigFile(this);
    }
    selectedColumns = await getSelectedColumnsViaPrompt(this, fullSchemaJson, cloneConfigJson);
  }
  if (flags.mode === 'prompt' && selectedColumns.length === 0) {
    this.process.stderr.write(chalk.red(`No columns were selected, cannot proceed.\n`));
    this.process.exit(1);
  }

  if (flags.mode === 'web') {
    return exitWithError(this, 'Web mode is not available yet. Use --mode auto, prompt or ai.');
  }

  if (flags.mode === 'ai') {
    if (!env.ANTHROPIC_API_KEY) {
      return exitWithError(this, 'Set ANTHROPIC_API_KEY in the environment to use --mode ai.');
    }
    this.process.stdout.write(chalk.blue('Using AI to generate clone config...\n'));

    const formattedSchema = formatSchemaForAI(fullSchemaJson);
    const basePrompt =
      flags.prompt ||
      'Generate a strict anonymization config. Treat all likely PII and sensitive data as needing strong protection. Default non-PII columns to noop.';

    const MAX_AI_VALIDATION_ATTEMPTS = 3;
    let previousConfigYaml: string | undefined;
    if (this.fs.existsSync(DEFAULT_CLONE_RULES_FILE)) {
      previousConfigYaml = this.fs.readFileSync(DEFAULT_CLONE_RULES_FILE, 'utf-8');
    }

    let lastErrors: string[] = [];

    for (let attempt = 1; attempt <= MAX_AI_VALIDATION_ATTEMPTS; attempt++) {
      if (this.debug) {
        this.process.stdout.write(`DEBUG: AI config generation attempt ${attempt}\n`);
      }

      const feedback = formatValidationErrorsForPrompt(lastErrors);
      const effectivePrompt = feedback.length > 0 ? `${basePrompt}\n\n${feedback}` : basePrompt;

      let aiConfigJson;
      try {
        aiConfigJson = await generateCloneConfig(
          env.ANTHROPIC_API_KEY,
          effectivePrompt,
          formattedSchema,
          previousConfigYaml,
          { model: flags.model }
        );
      } catch (err) {
        this.process.stderr.write(
          chalk.red(`Failed to generate config with AI: ${err instanceof Error ? err.message : String(err)}\n`)
        );
        this.process.exit(1);
      }
      aiConfigJson.transformations.validation_mode = validationMode;

      writeSortedCloneConfig(this, aiConfigJson);

      if (this.debug) {
        this.process.stdout.write(
          chalk.blue(`\nValidating AI-generated config (attempt ${attempt}/${MAX_AI_VALIDATION_ATTEMPTS})...\n`)
        );
      }

      let validationResult;
      try {
        validationResult = await validateCloneRulesWithPgstream(this, sourceUrl);
      } catch (err) {
        this.process.stderr.write(
          chalk.red(`Failed to validate config: ${err instanceof Error ? err.message : String(err)}\n`)
        );
        this.process.exit(1);
      }

      if (validationResult.valid) {
        if (attempt > 1) {
          this.process.stdout.write(
            chalk.green(`AI-generated config passed pgstream validation on attempt ${attempt}.\n`)
          );
        } else {
          this.process.stdout.write(chalk.green('AI-generated config passed pgstream validation.\n'));
        }
        return;
      }

      lastErrors = validationResult.errors;
      if (lastErrors.length === 0) {
        lastErrors = [`Validation failed with exit code ${validationResult.exitCode} but no specific errors provided`];
      }

      this.process.stdout.write(
        chalk.yellow(
          `AI-generated config failed pgstream validation (attempt ${attempt}/${MAX_AI_VALIDATION_ATTEMPTS}).\n`
        )
      );

      if (this.debug) {
        this.process.stdout.write(`DEBUG: Validation errors:\n${JSON.stringify(validationResult.rawJson, null, 2)}\n`);
      }

      previousConfigYaml = this.fs.readFileSync(DEFAULT_CLONE_RULES_FILE, 'utf-8');
    }

    this.process.stderr.write(
      chalk.red(
        `Failed to produce a pgstream-valid anonymization config after ${MAX_AI_VALIDATION_ATTEMPTS} AI attempts.\n` +
          `The last invalid config has been left in ${DEFAULT_CLONE_RULES_FILE} for manual editing.\n` +
          `Last validation errors:\n${lastErrors.map((e, i) => `  ${i + 1}. ${e}`).join('\n')}\n`
      )
    );
    this.process.exit(1);
  }

  const jsonTransformationsConfig = await getTransformsConfig(this, fullSchemaJson, selectedColumns, validationMode);
  writeSortedCloneConfig(this, jsonTransformationsConfig);
}

export const CloneConfigCommand = buildCommand({
  docs: {
    brief: 'Write the anonymization rules that clone start and stream apply',
    fullDescription:
      'Inspects the source database and writes `.xata/clone.yaml`, interactively or with AI, so the columns that carry personal data are transformed as they are copied.'
  },
  parameters: {
    flags: {
      'source-url': {
        kind: 'parsed',
        parse: String,
        brief: 'The source URL of the database to clone',
        optional: false
      },
      mode: {
        kind: 'enum',
        values: ['auto', 'prompt', 'web', 'ai'],
        brief: 'The assisting mode to help with the configuration generation',
        default: 'prompt'
      },
      'validation-mode': {
        kind: 'enum',
        values: ['strict', 'relaxed', 'prompt'],
        brief: 'Anonymization validation mode, strict implies that all tables and columns should be specified',
        default: 'prompt'
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
        brief: 'Branch ID or name',
        parse: String,
        optional: true
      },
      prompt: {
        kind: 'parsed',
        brief: 'Instructions for AI mode (e.g., which columns to anonymize, specific transformers to use)',
        parse: String,
        optional: true
      },
      model: {
        kind: 'parsed',
        brief: 'Anthropic model override for AI mode',
        parse: String,
        optional: true
      }
    }
  },
  func: implementation
});
