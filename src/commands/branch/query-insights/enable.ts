import { buildCommand } from '@stricli/core';
import {
  checkPgStatStatementsUsable,
  createPgStatStatementsExtension,
  getPgStatStatementsStatus,
  PG_STAT_STATEMENTS_EXTENSION
} from '@xata.io/sql';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { CLI_NAME } from '~/lib/constants';
import {
  executeQuery,
  formatQueryInsightsError,
  resolveBranchQueryInsightsTarget,
  withBranchAdminSql,
  type BranchQueryInsightsFlags
} from './shared';

type Flags = BranchQueryInsightsFlags & {
  json: boolean;
};

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  const target = await resolveBranchQueryInsightsTarget(this, flags, branchName);
  if (!target) return;

  const { organizationId, projectId, branchId, branch } = target;
  const availableExtensionsData = await this.api.projects.listExtensions({
    pathParams: { organizationID: organizationId },
    queryParams: { image: branch.configuration.image, region: branch.region }
  });
  const extension = availableExtensionsData.extensions.find((ext) => ext.name === PG_STAT_STATEMENTS_EXTENSION);

  if (!extension) {
    const message = `${PG_STAT_STATEMENTS_EXTENSION} is not available for this branch image/region.`;
    if (flags.json) this.print(this, true, { enabled: false, preloaded: false, branchId, error: message });
    else this.process.stderr.write(chalk.red(`${message}\n`));
    this.process.exitCode = 1;
    return;
  }

  const preloadedLibraries = branch.configuration.preloadLibraries ?? [];
  const isConfiguredForPreload = preloadedLibraries.includes(PG_STAT_STATEMENTS_EXTENSION);

  if (extension.preloadRequired && !isConfiguredForPreload) {
    await this.api.branches.updateBranch({
      pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId },
      body: { preloadLibraries: [...preloadedLibraries, PG_STAT_STATEMENTS_EXTENSION] }
    });

    const waitCommand = `${CLI_NAME} branch wait-ready ${branch.name} --wake`;
    if (flags.json) {
      this.print(this, true, {
        enabled: false,
        preloaded: true,
        branchId,
        restartRequired: true,
        waitCommand
      });
      return;
    }

    this.process.stdout.write(
      chalk.green(`${PG_STAT_STATEMENTS_EXTENSION} added to preload libraries. The branch will restart.\n`)
    );
    this.process.stdout.write(`Wait for it to become ready, then run this command again:\n  ${waitCommand}\n`);
    return;
  }

  try {
    await withBranchAdminSql(this, target, async (sql) => {
      const statusRows = await executeQuery<{ installed: boolean; preloaded: boolean }>(
        sql,
        getPgStatStatementsStatus.fn()
      );
      const status = statusRows[0];

      if (extension.preloadRequired && !status?.preloaded) {
        const waitCommand = `${CLI_NAME} branch wait-ready ${branch.name} --wake`;
        const message = `${PG_STAT_STATEMENTS_EXTENSION} is configured for preload but is not loaded yet. Run \`${waitCommand}\` and try again.`;
        if (flags.json) this.print(this, true, { enabled: false, preloaded: false, branchId, error: message });
        else this.process.stderr.write(chalk.yellow(`${message}\n`));
        this.process.exitCode = 1;
        return;
      }

      if (!status?.installed) {
        await executeQuery(sql, createPgStatStatementsExtension());
      }
      await executeQuery(sql, checkPgStatStatementsUsable());

      if (flags.json) {
        this.print(this, true, { enabled: true, preloaded: Boolean(status?.preloaded), branchId });
        return;
      }
      this.process.stdout.write(chalk.green(`${PG_STAT_STATEMENTS_EXTENSION} is enabled and ready.\n`));
    });
  } catch (error) {
    const message = formatQueryInsightsError(error);
    if (flags.json)
      this.print(this, true, { enabled: false, preloaded: isConfiguredForPreload, branchId, error: message });
    else this.process.stderr.write(chalk.red(`${message}\n`));
    this.process.exitCode = 1;
  }
}

export const QueryInsightsEnableCommand = buildCommand({
  docs: {
    brief: 'Enable pg_stat_statements for query insights on a branch',
    fullDescription:
      'Creates the `pg_stat_statements` extension and adds it to the preloaded libraries, which needs a branch restart: wait for it with `xata branch wait-ready <branch> --wake`. Operations that rebuild a branch, such as a migration into it, can drop the extension, so run this again if query insights stop returning rows.'
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
          brief: 'The branch to enable query insights for',
          parse: String,
          placeholder: 'branch name',
          optional: true
        }
      ]
    }
  },
  func: implementation
});
