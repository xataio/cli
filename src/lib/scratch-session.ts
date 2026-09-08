import chalk from 'chalk';
import { randomUUID } from 'node:crypto';
import { parse } from 'pg-connection-string';
import type { LocalContext } from '~/context';
import { getErrorMessage } from '~/lib/cli-utils';

export const SCRATCH_SCALE_TO_ZERO = {
  enabled: true,
  inactivityPeriodMinutes: 10
} as const;

export type ScratchBranch = {
  id: string;
  name: string;
};

export function newScratchBranchName() {
  return `scratch-${randomUUID()}`;
}

export function resolveExecutable(context: LocalContext, binary: string) {
  const hasPathSeparator = binary.includes('/') || binary.includes('\\');
  const candidates = hasPathSeparator
    ? [binary]
    : (context.process.env?.PATH ?? '')
        .split(context.path.delimiter)
        .filter(Boolean)
        .flatMap((directory) => {
          const candidate = context.path.join(directory, binary);
          if (context.process.platform !== 'win32') return [candidate];

          const extensions = (context.process.env?.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';');
          return [candidate, ...extensions.map((extension) => `${candidate}${extension}`)];
        });

  for (const candidate of candidates) {
    try {
      context.fs.accessSync(candidate, context.fs.constants.X_OK);
      return candidate;
    } catch {
      // Keep looking.
    }
  }

  return null;
}

export function buildPostgresEnvironment(connectionString: string, database: string) {
  const parsed = parse(withoutSslMode(connectionString));

  return {
    DATABASE_URL: connectionString,
    XATA_DATABASE_URL: connectionString,
    PGHOST: parsed.host ?? undefined,
    PGPORT: parsed.port || '5432',
    PGUSER: parsed.user,
    PGPASSWORD: parsed.password,
    PGDATABASE: database,
    PGSSLMODE: 'require'
  };
}

function withoutSslMode(connectionString: string) {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    return connectionString;
  }
}

export async function waitForBranchReady(
  context: LocalContext,
  organizationId: string,
  projectId: string,
  branchId: string,
  options: { timeoutMs?: number; signal?: AbortSignal } = {}
) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const startedAt = Date.now();

  while (true) {
    if (options.signal?.aborted) {
      throw new Error('Cancelled while waiting for the branch to become ready.');
    }
    const branch = await context.api.branches.describeBranch({
      pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
    });
    if (branch.status.statusType === 'STATUS_TYPE_HEALTHY') return branch;
    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(`Timed out waiting for branch ${branch.name} to become ready.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export async function deleteScratchBranch(
  context: LocalContext,
  organizationId: string,
  projectId: string,
  branch: ScratchBranch
) {
  try {
    await context.api.branches.deleteBranch({
      pathParams: { organizationID: organizationId, projectID: projectId, branchID: branch.id }
    });
    context.process.stderr.write(chalk.green(`Deleted scratch branch ${branch.name}\n`));
  } catch (error) {
    context.process.stderr.write(
      chalk.yellow(
        `Warning: failed to delete scratch branch ${branch.name} (${branch.id}): ${getErrorMessage(error)}\n` +
          `Delete it manually with: xata branch delete --branch ${branch.id} --yes\n`
      )
    );
  }
}

export async function runInteractivePostgresCommand(
  context: LocalContext,
  binary: string,
  args: string[],
  connectionString: string,
  database: string
) {
  const ignoreSignal = () => {};
  context.process.on('SIGINT', ignoreSignal);

  const stdin = context.process.stdin;
  if (stdin.isTTY) stdin.setRawMode(false);
  stdin.pause();

  try {
    const subprocess = Bun.spawn([binary, ...args], {
      env: {
        ...Bun.env,
        ...buildPostgresEnvironment(connectionString, database)
      },
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit'
    });

    return await subprocess.exited;
  } finally {
    context.process.off('SIGINT', ignoreSignal);
  }
}
