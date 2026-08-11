import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { resetQueryInsights } from './queries';
import { withBranchQueryInsightsSql, type BranchQueryInsightsFlags } from './shared';

type Flags = BranchQueryInsightsFlags & {
  yes: boolean;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  if (!flags.yes) {
    if (!this.isInteractive) {
      if (flags.json) {
        this.print(this, true, { reset: false, error: 'Confirmation required. Re-run with --yes to reset.' });
      } else {
        this.process.stderr.write(chalk.red('Confirmation required. Re-run with --yes to reset query statistics.\n'));
      }
      this.process.exitCode = 1;
      return;
    }

    const confirmed = await this.enquirer.confirmPrompt(
      this.isInteractive,
      'Reset all accumulated pg_stat_statements query statistics for this branch?'
    );
    if (!confirmed) {
      this.process.stdout.write('Aborted as there was no confirmation. Query statistics were not reset.\n');
      return;
    }
  }

  await withBranchQueryInsightsSql(this, flags, branchName, async (sql, meta) => {
    await resetQueryInsights(sql);
    if (flags.json) {
      this.print(this, true, { reset: true, branchId: meta.branchId });
      return;
    }
    this.process.stdout.write(chalk.green('Query statistics reset successfully.\n'));
  });
}

export const QueryInsightsResetCommand = buildCommand({
  docs: {
    brief: 'Reset accumulated query statistics for a branch',
    fullDescription: [
      'Calls `pg_stat_statements_reset()`, which requires elevated privileges.',
      'Warning: resetting is branch-wide and cannot be undone, all historical counters are discarded and rebuild as new queries run.'
    ].join('\n')
  },
  parameters: {
    flags: {
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
      yes: {
        kind: 'boolean',
        brief: 'Do not ask for confirmation, assume yes.',
        default: false
      },
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      }
    },
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'The branch to reset query statistics for',
          parse: String,
          placeholder: 'branch name',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
