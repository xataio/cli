import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { printQueryInsightDetails } from './display';
import { showQueryInsight } from './queries';
import { withBranchQueryInsightsSql, type BranchQueryInsightsFlags } from './shared';

type Flags = BranchQueryInsightsFlags & {
  db?: string;
  role?: string;
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags, queryId: string, branchName?: string) {
  await withBranchQueryInsightsSql(this, flags, branchName, async (sql) => {
    const result = await showQueryInsight(sql, queryId, { db: flags.db, role: flags.role });
    if (result.ambiguous) {
      this.process.stderr.write(
        chalk.yellow(
          `Query insight ${queryId} matched multiple database/role combinations. Re-run with --db and/or --role to select one.\n`
        )
      );
      this.process.exitCode = 1;
      return;
    }

    const row = result.row;
    if (!row) {
      this.process.stderr.write(chalk.yellow(`Query insight ${queryId} was not found in the current statistics.\n`));
      this.process.exitCode = 1;
      return;
    }

    if (flags.json) {
      this.print(this, true, row as unknown as Record<string, unknown>);
      return;
    }

    printQueryInsightDetails(this, row);
  });
}

export const QueryInsightsShowCommand = buildCommand({
  docs: {
    brief: 'Show full query statistics for a query ID',
    fullDescription:
      'A query ID is not unique on its own, the same normalized statement is recorded once per database and role that ran it. When the ID matches more than one row the command exits non-zero, re-run it with `--db` and `--role`. Human output ends with the potential issues found for the query.',
    customUsage: [
      {
        input: '-6744440887696913970 --db postgres --role postgres my-branch',
        brief: 'Full detail for one query'
      }
    ]
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
        brief: 'Branch ID or name',
        parse: String,
        optional: true
      },
      db: {
        kind: 'parsed',
        brief: 'Database name to disambiguate the query ID',
        parse: String,
        optional: true
      },
      role: {
        kind: 'parsed',
        brief: 'Role name to disambiguate the query ID',
        parse: String,
        optional: true
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
          brief: 'Query ID from pg_stat_statements',
          parse: String,
          placeholder: 'queryid'
        },
        {
          brief: 'The branch to inspect',
          parse: String,
          placeholder: 'branch',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
