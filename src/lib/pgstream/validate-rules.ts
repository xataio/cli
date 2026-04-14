import type { LocalContext } from '~/context';
import { runPgStream } from './commands';
import { DEFAULT_CLONE_RULES_FILE } from '../constants';

type PgstreamValidationResult = {
  valid: boolean;
  errors: string[];
  rawJson: unknown;
  exitCode: number;
};

export async function validateCloneRulesWithPgstream(
  context: LocalContext,
  postgresUrl: string,
  rulesFile: string = DEFAULT_CLONE_RULES_FILE
): Promise<PgstreamValidationResult> {
  const { exitCode, stdout, stderr } = await runPgStream(context, ['validate', 'rules'], undefined, {
    flags: [`--postgres-url=${postgresUrl}`, `--rules-file=${rulesFile}`, '--json'],
    captureOutput: true
  });

  if (context.debug) {
    context.process.stdout.write(
      `DEBUG: pgstream validate rules exitCode=${exitCode}\nstdout=${stdout}\nstderr=${stderr}\n`
    );
  }

  let parsed: { Valid?: boolean; Errors?: unknown };
  try {
    parsed = JSON.parse(stdout);
  } catch (err) {
    throw new Error(
      `Failed to parse pgstream validate JSON output (exitCode=${exitCode}): ${(err as Error).message}\nstdout: ${stdout}\nstderr: ${stderr}`
    );
  }

  const errors = Array.isArray(parsed.Errors) ? parsed.Errors : [];
  const hasValidField = typeof parsed.Valid === 'boolean';
  const valid = hasValidField ? Boolean(parsed.Valid) && exitCode === 0 : errors.length === 0 && exitCode === 0;

  return {
    valid,
    errors,
    rawJson: parsed,
    exitCode
  };
}

export function formatValidationErrorsForPrompt(errors: string[]): string {
  if (!errors.length) return '';

  const lines = errors.map((e, i) => `${i + 1}. ${e}`);

  return [
    'The previous config failed pgstream validation with these errors:',
    ...lines,
    '',
    'Please fix the config so that `pgstream validate rules` passes.',
    'Only adjust the minimal necessary transformers; keep the overall structure and coverage.',
    'Do not remove any tables or columns that exist in the schema.'
  ].join('\n');
}
