import { clearTimeout, setTimeout } from 'node:timers';
import { setTimeout as delay } from 'node:timers/promises';
import { ApiError, type Types } from '@xata.io/api';
import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import type { LocalContext } from '~/context';
import { getDescription } from '~/commands/branch/create';
import { exitWithError, exitWithErrorDetails, getErrorMessage } from '~/lib/cli-utils';
import { CLI_NAME } from '~/lib/constants';
import { describeWindow, formatRfc3339, parseRestoreTime, parseTimeout, windowError } from './restore-utils';

const DEFAULT_TIMEOUT = '30m';
const POLL_INTERVAL_MS = 2000;
const RESTORE_WINDOW_ERROR = /recovery window|targetTime/i;
const NO_RECOVERY_POINT_MESSAGE =
  'This branch has no recovery point yet. A branch can be restored once its first backup has been archived, so try again later.';

type Flags = {
  organization?: string;
  project?: string;
  branch?: string;
  name?: string;
  to?: string;
  description?: string;
  wait: boolean;
  timeout?: string;
  yes: boolean;
};

type PathParams = { organizationID: string; projectID: string; branchID: string };

const waitReadyCommand = (flags: Flags, branchId: string) =>
  [
    `${CLI_NAME} branch wait-ready ${branchId}`,
    flags.organization ? `--organization ${flags.organization}` : '',
    flags.project ? `--project ${flags.project}` : ''
  ]
    .filter(Boolean)
    .join(' ');

async function waitForRestoredBranch(
  context: LocalContext,
  flags: Flags,
  pathParams: PathParams,
  created: Types.BranchShortMetadata,
  timeoutMs: number
) {
  const deadline = Date.now() + timeoutMs;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<undefined>((resolve) => {
    timeout = setTimeout(() => resolve(undefined), timeoutMs);
  });
  let lastStatus = 'Not yet available';

  let announced: string | undefined;
  try {
    while (Date.now() < deadline) {
      const polled = await Promise.race([
        context.api.branches.describeBranch({ pathParams }).catch((error: unknown) => ({ error })),
        expired
      ]);
      if (!polled) break;
      if ('error' in polled) {
        lastStatus = `Status request failed: ${getErrorMessage(polled.error)}`;
      } else {
        lastStatus = polled.status.status;
        if (Date.now() >= deadline) break;
        if (polled.status.statusType === 'STATUS_TYPE_HEALTHY') {
          return polled;
        }
      }

      if (lastStatus !== announced) {
        announced = lastStatus;
        context.process.stderr.write(
          chalk.yellow(`Waiting for branch ${created.name} to be ready (${lastStatus})...\n`)
        );
      }
      await delay(Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())));
    }
    return exitWithErrorDetails(
      context,
      `Timed out waiting for the restored branch ${created.name} (${created.id}). Last status: ${lastStatus}. The restore may still be in progress, check it with \`${waitReadyCommand(flags, created.id)}\`.`,
      { branchId: created.id, name: created.name }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function implementation(this: LocalContext, flags: Flags, branchName?: string) {
  if (flags.timeout !== undefined && !flags.wait) {
    return exitWithError(this, '--timeout requires --wait');
  }
  const to = flags.to ?? 'latest';
  const targetTime = to === 'latest' ? undefined : parseRestoreTime(to);
  if (to !== 'latest' && !targetTime) {
    return exitWithError(
      this,
      `Invalid --to value "${to}". Use "latest" or a real RFC 3339 time with an explicit offset, such as 2026-10-20T14:30:00Z or 2026-10-20T16:30:00+02:00.`
    );
  }
  const timeout = flags.timeout ?? DEFAULT_TIMEOUT;
  const timeoutMs = parseTimeout(timeout);
  if (!timeoutMs) {
    return exitWithError(
      this,
      `Invalid --timeout value "${timeout}". Use a positive duration of at most 24h, such as 90s, 30m or 2h.`
    );
  }
  if (!flags.yes && !this.isInteractive) {
    return exitWithError(this, 'Cannot restore a branch without confirmation. Pass --yes to confirm.');
  }
  const description = getDescription(this, flags);

  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });
  const sourceBranchId = await this.getBranch(this, flags, { organizationId, projectId, branchName });

  const name = await this.enquirer.inputPrompt(this.isInteractive, 'Please enter the name of the restored branch', {
    flag: flags.name
  });
  if (!name) {
    return exitWithError(this, 'Expected input for flag --name');
  }

  const sourcePathParams = { organizationID: organizationId, projectID: projectId, branchID: sourceBranchId };
  const source = await this.api.branches.describeBranch({ pathParams: sourcePathParams });
  const backup = await this.api.projects
    .getBackup({
      pathParams: { organizationID: organizationId, projectID: projectId, backupID: sourceBranchId }
    })
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) {
        return exitWithError(this, `Branch "${source.name}" has no backups. Backups may not be enabled in its region.`);
      }
      throw error;
    });
  const { earliestRestore, latestRestore } = backup;
  if (!earliestRestore) {
    return exitWithError(this, NO_RECOVERY_POINT_MESSAGE);
  }
  const window = { earliestRestore, latestRestore };

  if (targetTime) {
    const error = windowError(targetTime, window, new Date());
    if (error) {
      return exitWithError(this, error);
    }
  }

  this.process.stderr.write(
    `${[
      `Restore branch ${chalk.bold(source.name)} (${source.id})`,
      `  Window:       ${describeWindow(window)}`,
      `  Target:       ${targetTime ? formatRfc3339(targetTime) : 'latest'}`,
      `  New branch:   ${name}`,
      `  Config:       instance type, storage and Postgres settings are copied from ${source.name}; backups and scale to zero use the defaults`,
      ''
    ].join('\n')}\n`
  );

  if (!flags.yes) {
    const confirmed = await this.enquirer.confirmPrompt(this.isInteractive, `Create branch ${name} from this restore?`);
    if (!confirmed) {
      return exitWithError(this, 'Aborted as there was no confirmation. No branch was created.');
    }
  }

  const created = await this.api.branches
    .restoreFromBackup({ pathParams: sourcePathParams, body: { name, description, targetTime } })
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 412) {
        return exitWithError(this, NO_RECOVERY_POINT_MESSAGE);
      }
      if (error instanceof ApiError && error.status === 400) {
        const rejected = `The restore request was rejected: ${error.message}`;
        return exitWithError(
          this,
          targetTime && RESTORE_WINDOW_ERROR.test(error.message)
            ? `${rejected}\nThe restore window is ${describeWindow(window)}.`
            : rejected
        );
      }
      if (error instanceof ApiError && error.status === 404) {
        return exitWithError(this, `Branch ${source.name} was not found: ${error.message}`);
      }
      throw error;
    });

  const branch = flags.wait
    ? await waitForRestoredBranch(
        this,
        flags,
        { organizationID: organizationId, projectID: projectId, branchID: created.id },
        created,
        timeoutMs
      )
    : created;

  this.printDetails(this, branch, [
    ['branch_id', branch.id],
    ['name', branch.name],
    ['parent_id', branch.parentID ?? ''],
    ['created_at', branch.createdAt]
  ]);

  if (!flags.wait && !this.outputJson) {
    this.process.stderr.write(
      `The branch is being restored. Run \`${waitReadyCommand(flags, branch.id)}\` to wait for it, or pass --wait next time.\n`
    );
  }
}

export const BackupRestoreCommand = buildCommand({
  docs: {
    brief: 'Restore a branch to a new branch from its backups',
    fullDescription: [
      'Creates a new branch from the continuous backups of an existing one, at the latest recovery point or at a chosen time. The source branch is not changed. The latest recovery point can lag up to about 5 minutes behind now.',
      'The new branch copies the instance type, storage and Postgres settings of the source branch; its backups and scale to zero use the defaults. Outside an interactive terminal the confirmation has to come from `--yes`.'
    ].join('\n'),
    customUsage: [
      {
        input: '--branch main --name main-restored',
        brief: 'Restore to the latest recovery point'
      },
      {
        input: '--branch main --name main-before-incident --to 2026-10-20T14:30:00Z',
        brief: 'Restore to a point in time, written with an explicit offset'
      },
      {
        input: '--branch main --name main-restored --yes --wait --json',
        brief: 'Restore from a script'
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
        brief: 'Source branch ID or name to restore from',
        parse: String,
        optional: true
      },
      name: {
        kind: 'parsed',
        brief: 'Name of the new branch',
        parse: String,
        optional: true
      },
      to: {
        kind: 'parsed',
        brief: 'Point in time to restore to: "latest" or an RFC 3339 time with an offset (default: latest)',
        parse: String,
        optional: true
      },
      description: {
        kind: 'parsed',
        brief: 'Description of the new branch',
        parse: String,
        optional: true
      },
      wait: {
        kind: 'boolean',
        brief: 'Wait until the new branch is ready',
        default: false
      },
      timeout: {
        kind: 'parsed',
        brief: `How long --wait polls before giving up, such as 90s, 30m or 2h (default: ${DEFAULT_TIMEOUT})`,
        parse: String,
        optional: true
      },
      yes: {
        kind: 'boolean',
        brief: 'Do not ask for confirmation, assume yes.',
        default: false
      }
    },
    positional: {
      kind: 'tuple',
      parameters: [
        {
          brief: 'Source branch ID or name to restore from',
          placeholder: 'branch',
          parse: String,
          optional: true
        }
      ] as const
    }
  },
  func: implementation
});
