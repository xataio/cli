import { buildCredentialsConnectionString, fetchBranchCredentials } from '@xata.io/sql';
import chalk from 'chalk';
import { setTimeout as delay } from 'node:timers/promises';
import type { LocalContext } from '~/context';
import { createChildBranch } from '~/lib/branch-actions';
import { getErrorMessage } from '~/lib/cli-utils';
import {
  newScratchBranchName,
  runInteractivePostgresCommand,
  SCRATCH_SCALE_TO_ZERO,
  type ScratchBranch,
  waitForBranchReady
} from '~/lib/scratch-session';
import type { ConsoleHandoff } from './types';

type ScratchHandoff = Extract<ConsoleHandoff, { kind: 'scratch-psql' }>;

function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      }
    );
  });
}

async function cleanupScratchBranch(
  context: LocalContext,
  handoff: ScratchHandoff,
  branchName: string,
  creation: Promise<ScratchBranch>,
  knownBranch: ScratchBranch | undefined
) {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(new Error('Timed out cleaning up scratch branch.')), 10_000);
  let branch = knownBranch;
  const created = creation.catch(() => new Promise<ScratchBranch>(() => {}));

  try {
    while (!branch) {
      branch = await untilAborted(
        Promise.race([created, findScratchBranch(context, handoff, branchName)]),
        timeout.signal
      );
      if (!branch) {
        branch = await untilAborted(
          Promise.race([created, delay(250, undefined, { signal: timeout.signal })]),
          timeout.signal
        );
      }
    }

    await untilAborted(
      context.api.branches.deleteBranch({
        pathParams: {
          organizationID: handoff.organizationId,
          projectID: handoff.projectId,
          branchID: branch.id
        }
      }),
      timeout.signal
    );
    context.process.stderr.write(chalk.green(`Deleted scratch branch ${branch.name}\n`));
  } catch (error) {
    context.process.stderr.write(
      chalk.yellow(
        `Warning: could not confirm cleanup of scratch branch ${branchName}: ${getErrorMessage(error)}\n` +
          `Delete it manually with: xata branch delete --organization ${handoff.organizationId} --project ${handoff.projectId} --branch ${branch?.id ?? branchName} --yes\n`
      )
    );
  } finally {
    clearTimeout(timer);
    timeout.abort();
  }
}

async function findScratchBranch(context: LocalContext, handoff: ScratchHandoff, branchName: string) {
  const result = await context.api.branches
    .listBranches({
      pathParams: { organizationID: handoff.organizationId, projectID: handoff.projectId }
    })
    .catch(() => undefined);
  const matches = result?.branches.filter((branch) => branch.name === branchName) ?? [];
  if (matches.length > 1) throw new Error('Multiple branches match the generated scratch name.');
  return matches[0];
}

export async function runScratchHandoff(context: LocalContext, handoff: ScratchHandoff, psql: string) {
  const branchName = newScratchBranchName();
  const cancellation = new AbortController();
  let branch: ScratchBranch | undefined;
  let childActive = false;
  const cancel = () => {
    if (!childActive) cancellation.abort(new Error('Cancelled scratch session.'));
  };
  context.process.on('SIGINT', cancel);

  const creation = createChildBranch(context, {
    organizationId: handoff.organizationId,
    projectId: handoff.projectId,
    parentBranch: handoff.parentBranchId,
    name: branchName,
    scaleToZero: SCRATCH_SCALE_TO_ZERO.enabled,
    inactivityPeriodMinutes: SCRATCH_SCALE_TO_ZERO.inactivityPeriodMinutes
  });

  try {
    context.process.stderr.write(chalk.gray(`Creating scratch branch from ${handoff.parentBranchName}…\n`));
    branch = await untilAborted(creation, cancellation.signal);
    cancellation.signal.throwIfAborted();
    context.process.stderr.write(chalk.green(`Created scratch branch ${branch.name}\n`));
    context.process.stderr.write(chalk.gray(`Waiting for ${branch.name} to be ready… (ctrl+c cancels)\n`));
    await untilAborted(
      waitForBranchReady(context, handoff.organizationId, handoff.projectId, branch.id, {
        timeoutMs: 300_000,
        signal: cancellation.signal
      }),
      cancellation.signal
    );
    cancellation.signal.throwIfAborted();
    const credentials = await untilAborted(
      fetchBranchCredentials(context.api, {
        organizationID: handoff.organizationId,
        projectID: handoff.projectId,
        branchID: branch.id
      }),
      cancellation.signal
    );
    cancellation.signal.throwIfAborted();
    const connectionString = buildCredentialsConnectionString(credentials, {
      database: handoff.database,
      endpointType: 'rw'
    });
    context.process.stderr.write(
      chalk.gray(`Connecting psql to ${branch.name}. Quitting psql (\\q) deletes the scratch branch.\n`)
    );
    childActive = true;
    try {
      await runInteractivePostgresCommand(context, psql, [], connectionString, handoff.database);
    } finally {
      childActive = false;
    }
  } finally {
    try {
      await cleanupScratchBranch(context, handoff, branchName, creation, branch);
    } finally {
      context.process.off('SIGINT', cancel);
    }
    if (cancellation.signal.aborted) context.process.exit(130);
  }
}
