import { buildCommand } from '@stricli/core';
import { buildCredentialsConnectionString, fetchBranchCredentials } from '@xata.io/sql';
import chalk from 'chalk';
import { randomUUID } from 'node:crypto';
import { parse } from 'pg-connection-string';
import invariant from 'tiny-invariant';
import type { LocalContext } from '~/context';
import { renderTable } from '~/lib/table';
import { createChildBranch, getParentBranchId } from './branch/create';

type Flags = {
  organization?: string;
  project?: string;
  'parent-branch'?: string;
  database?: string;
  execute?: string;
  json: boolean;
};

const SIGNAL_CLEANUP_TIMEOUT_MS = 10 * 1000;
const SCRATCH_SCALE_TO_ZERO = {
  enabled: true,
  inactivityPeriodMinutes: 10
} as const;

type ScratchBranch = {
  id: string;
  name: string;
};

type Signal = 'SIGINT' | 'SIGTERM' | 'SIGHUP';

function signalExitCode(signal: Signal) {
  switch (signal) {
    case 'SIGINT':
      return 130;
    case 'SIGTERM':
      return 143;
    case 'SIGHUP':
      return 129;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Timed out waiting for scratch cleanup.')), ms);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) return String(error.message);
  return String(error);
}

function formatCell(value: unknown) {
  if (value === null) return 'NULL';
  if (value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function printSQLResult(context: LocalContext, json: boolean, result: unknown[]) {
  if (json) {
    context.print(context, true, result as Record<string, unknown>[]);
    return;
  }

  const rows = result.filter((row): row is Record<string, unknown> => {
    return typeof row === 'object' && row !== null && !Array.isArray(row);
  });

  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];

  if (headers.length === 0) {
    const count =
      typeof (result as unknown as { count?: unknown }).count === 'number'
        ? (result as unknown as { count: number }).count
        : result.length;
    const table = renderTable(['result'], [[`Query executed successfully. ${count} row(s) returned.`]]);
    context.process.stdout.write(`${table}\n`);
    return;
  }

  const tableRows = rows.map((row) => headers.map((header) => formatCell(row[header])));
  context.process.stdout.write(`${renderTable(headers, tableRows)}\n`);
}

function resolveExecutable(context: LocalContext, binary: string) {
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

function buildPostgresEnvironment(connectionString: string, database: string) {
  const parsed = parse(connectionString);

  return {
    DATABASE_URL: connectionString,
    XATA_DATABASE_URL: connectionString,
    PGHOST: parsed.host ?? undefined,
    PGPORT: parsed.port ?? '5432',
    PGUSER: parsed.user,
    PGPASSWORD: parsed.password,
    PGDATABASE: database,
    PGSSLMODE: 'require'
  };
}

async function executeSQL(context: LocalContext, query: string, connectionString: string) {
  const db = context.postgres(connectionString);

  try {
    const result = await db.unsafe(query);
    return Array.isArray(result) ? result : [result];
  } finally {
    await db.end();
  }
}

function spawnBinary(binary: string, args: string[], connectionString: string, database: string) {
  const subprocess = Bun.spawn([binary, ...args], {
    env: {
      ...Bun.env,
      ...buildPostgresEnvironment(connectionString, database)
    },
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit'
  });

  return subprocess;
}

async function deleteScratchBranch(
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

async function deleteScratchBranchByName(
  context: LocalContext,
  organizationId: string,
  projectId: string,
  branchName: string
) {
  const { branches } = await context.api.branches.listBranches({
    pathParams: { organizationID: organizationId, projectID: projectId }
  });
  const matchingBranches = branches.filter((branch) => branch.name === branchName);

  const matchingBranch = matchingBranches[0];
  if (matchingBranches.length === 1 && matchingBranch) {
    await deleteScratchBranch(context, organizationId, projectId, matchingBranch);
  }
}

export async function implementation(this: LocalContext, flags: Flags, ...command: string[]) {
  const hasQuery = Boolean(flags.execute);
  const hasBinary = command.length > 0;

  if (hasQuery && hasBinary) {
    this.process.stderr.write(
      chalk.red('Use either --execute/-x <sql> or -- <command> [arguments...], not both.\n')
    );
    this.process.exit(1);
  }

  if (!hasQuery && !hasBinary) {
    this.process.stderr.write(chalk.red('Expected --execute/-x <sql> or -- <command> [arguments...].\n'));
    this.process.exit(1);
  }

  if (flags.json && hasBinary) {
    this.process.stderr.write(chalk.red('--json is only supported with --execute/-x.\n'));
    this.process.exit(1);
  }

  const [binary, ...binaryArgs] = command;
  const resolvedBinary = binary ? resolveExecutable(this, binary) : null;

  if (binary && !resolvedBinary) {
    this.process.stderr.write(chalk.red(`Executable not found: ${binary}\n`));
    this.process.exit(1);
  }

  const organizationId = await this.getOrganization(this, flags, {});
  const projectId = await this.getProject(this, flags, { organizationId });

  const parentBranchId = flags['parent-branch']
    ? await getParentBranchId(this, flags['parent-branch'], { organizationId, projectId })
    : await this.getBranch(this, {}, { organizationId, projectId });
  if (!parentBranchId) {
    this.process.stderr.write(
      chalk.red('Expected a source branch. Pass --parent-branch or initialize the project with xata init.\n')
    );
    this.process.exit(1);
  }

  const database = await this.getDatabase(flags);
  if (!database) {
    this.process.stderr.write(chalk.red('Expected input for flag --database\n'));
    this.process.exit(1);
  }

  const runId = randomUUID();
  const branchName = `scratch-${runId}`;
  let scratchBranch: ScratchBranch | undefined;
  let createBranchPromise: Promise<ScratchBranch> | undefined;
  let binaryExitCode: number | undefined;
  let currentSubprocess: ReturnType<typeof Bun.spawn> | undefined;
  let cleanupPromise: Promise<void> | undefined;
  let receivedSignal = false;

  const cleanup = () => {
    cleanupPromise ??= (async () => {
      if (!scratchBranch && createBranchPromise) {
        try {
          scratchBranch = await createBranchPromise;
        } catch {
          // The create request may still have succeeded server-side even if the
          // client lost the response. Only target the exact generated name.
        }
      }

      if (scratchBranch) {
        await deleteScratchBranch(this, organizationId, projectId, scratchBranch);
        return;
      }

      if (createBranchPromise) {
        try {
          await deleteScratchBranchByName(this, organizationId, projectId, branchName);
        } catch {
          // Do not warn about possibly existing scratch branches unless we can pinpoint
          // the exact generated branch and attempt deleting it.
        }
      }
    })();

    return cleanupPromise;
  };

  const handleSignal = async (signal: Signal) => {
    if (receivedSignal) {
      this.process.exit(signalExitCode(signal));
    }
    receivedSignal = true;

    try {
      currentSubprocess?.kill(signal);
    } catch {
      // The subprocess may have already exited.
    }

    try {
      await withTimeout(cleanup(), SIGNAL_CLEANUP_TIMEOUT_MS);
    } catch (error) {
      this.process.stderr.write(
        chalk.yellow(`Warning: failed to clean up scratch branch before exiting: ${getErrorMessage(error)}\n`)
      );
    } finally {
      this.process.exit(signalExitCode(signal));
    }
  };

  const signalHandlers = new Map<Signal, () => void>();
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    const handler = () => {
      void handleSignal(signal);
    };
    signalHandlers.set(signal, handler);
    this.process.once(signal, handler);
  }

  try {
    createBranchPromise = createChildBranch(
      this,
      organizationId,
      projectId,
      parentBranchId,
      branchName,
      SCRATCH_SCALE_TO_ZERO.enabled,
      SCRATCH_SCALE_TO_ZERO.inactivityPeriodMinutes
    );
    const createdScratchBranch = await createBranchPromise;
    scratchBranch = createdScratchBranch;

    this.process.stderr.write(chalk.green(`Created scratch branch ${createdScratchBranch.name}\n`));

    const credentials = await fetchBranchCredentials(this.api, {
      organizationID: organizationId,
      projectID: projectId,
      branchID: createdScratchBranch.id
    });

    const connectionString = buildCredentialsConnectionString(credentials, {
      database,
      endpointType: 'rw'
    });

    if (flags.execute) {
      const result = await executeSQL(this, flags.execute, connectionString);
      printSQLResult(this, flags.json, result);
    } else {
      invariant(resolvedBinary, 'Binary should have been resolved before creating the scratch branch.');
      this.process.stderr.write(
        chalk.gray(
          `Running ${binary} with DATABASE_URL, XATA_DATABASE_URL, and standard PG* environment variables set.\n`
        )
      );
      currentSubprocess = spawnBinary(resolvedBinary, binaryArgs, connectionString, database);
      binaryExitCode = await currentSubprocess.exited;
    }
  } finally {
    if (!receivedSignal) {
      await cleanup();

      for (const [signal, handler] of signalHandlers) {
        this.process.off(signal, handler);
      }
    }
  }

  if (binaryExitCode && binaryExitCode !== 0) {
    this.process.exit(binaryExitCode);
  }
}

export const ScratchCommand = buildCommand({
  docs: {
    brief: 'Run SQL or a Postgres client command against a temporary scratch branch',
    fullDescription:
      'Creates a branch from the parent given, runs what it is asked to, and deletes the branch afterwards, so a query or a migration can be tried against real data without touching an existing branch.',
    customUsage: [
      { input: '--execute "select count(*) from users"', brief: 'Run SQL with the built-in client' },
      { input: '-x "select count(*) from users"', brief: 'Run SQL using the short execute flag' },
      { input: '-- psql -c "select count(*) from users"', brief: 'Run psql with arguments' },
      { input: '-- npm run migrate', brief: 'Run a database tool against the scratch branch' }
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
      'parent-branch': {
        kind: 'parsed',
        brief: 'Source branch ID or name for the scratch branch',
        parse: String,
        optional: true
      },
      database: {
        kind: 'parsed',
        brief: 'Database name',
        parse: String,
        optional: true
      },
      execute: {
        kind: 'parsed',
        brief: 'SQL query to execute in the scratch branch',
        parse: String,
        optional: true
      },
      json: {
        kind: 'boolean',
        brief: 'Output SQL query results in JSON format',
        default: false
      }
    },
    aliases: {
      x: 'execute'
    },
    positional: {
      kind: 'array',
      minimum: 0,
      parameter: {
        brief: 'Command and arguments to run with scratch database environment variables; place child options after --',
        parse: String,
        placeholder: 'command'
      }
    }
  },
  func: implementation
});
