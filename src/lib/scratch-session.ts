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
