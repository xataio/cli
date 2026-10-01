import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { SkillFile } from './registry';

type Destination = { path: string; agents: string[] };
export type InstallResult = Destination & { status: 'installed' | 'replaced' | 'unchanged' | 'skipped' };

const stat = async (path: string) => {
  try {
    return await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
};

const assertSafePath = async (path: string) => {
  let current = resolve(path);
  while (true) {
    const info = await stat(current);
    if (info && (!info.isDirectory() || info.isSymbolicLink()))
      throw new Error(`Refusing non-directory or symlink destination: ${current}`);
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
};

const hashDirectory = async (path: string): Promise<string | undefined> => {
  const info = await stat(path);
  if (!info) return undefined;
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Unsafe destination: ${path}`);
  const hash = createHash('sha256');
  for (const name of (await readdir(path)).sort()) {
    const child = join(path, name);
    const childInfo = await lstat(child);
    hash.update(`${name}\0`);
    if (childInfo.isSymbolicLink()) throw new Error(`Refusing existing symlink: ${child}`);
    if (childInfo.isDirectory()) hash.update(`directory:${await hashDirectory(child)}`);
    else if (childInfo.isFile()) {
      hash.update(`file:${process.platform === 'win32' ? 0 : childInfo.mode & 0o111}:`);
      hash.update(await readFile(child));
    } else throw new Error(`Unsupported destination entry: ${child}`);
    hash.update('\0');
  }
  return hash.digest('hex');
};

export const installSkills = async (
  destinations: Destination[],
  files: SkillFile[],
  options: {
    force: boolean;
    approve: (path: string) => Promise<boolean>;
    reportPlan: (plan: InstallResult[]) => void;
  }
): Promise<InstallResult[]> => {
  const locks: string[] = [];
  const stages: string[] = [];
  const plans: (InstallResult & { before?: string; stage: string })[] = [];
  const completed: string[] = [];
  let failure: Error | undefined;
  try {
    for (const destination of [...destinations].sort((a, b) => a.path.localeCompare(b.path))) {
      await assertSafePath(destination.path);
      const parent = dirname(destination.path);
      await mkdir(parent, { recursive: true });
      const lock = `${destination.path}.xata-install-lock`;
      try {
        await mkdir(lock);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST')
          throw new Error(`Another install may be running. If it stopped, remove ${lock} and retry.`);
        throw error;
      }
      locks.push(lock);
      await assertSafePath(destination.path);
      const before = await hashDirectory(destination.path);
      const stage = await mkdtemp(join(parent, '.xata-skill-'));
      stages.push(stage);
      const payload = join(stage, 'payload');
      await mkdir(payload);
      for (const file of files) {
        const target = join(payload, file.path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, file.content, { mode: file.executable ? 0o755 : 0o644, flag: 'wx' });
      }
      const status =
        before === (await hashDirectory(payload)) ? 'unchanged' : before === undefined ? 'installed' : 'replaced';
      plans.push({ ...destination, before, stage, status });
    }
    options.reportPlan(plans.map(({ path, agents, status }) => ({ path, agents, status })));
    for (const plan of plans) {
      if (plan.status === 'replaced' && !options.force && !(await options.approve(plan.path))) plan.status = 'skipped';
    }
    for (const plan of plans) {
      if (plan.status === 'unchanged' || plan.status === 'skipped') continue;
      await assertSafePath(plan.path);
      if ((await hashDirectory(plan.path)) !== plan.before)
        throw new Error(`Destination changed during installation: ${plan.path}. Retry after reviewing it.`);
      const backup = join(plan.stage, 'backup');
      if (plan.before !== undefined) await rename(plan.path, backup);
      try {
        await rename(join(plan.stage, 'payload'), plan.path);
      } catch (error) {
        if (plan.before !== undefined) {
          try {
            await rename(backup, plan.path);
          } catch {
            stages.splice(stages.indexOf(plan.stage), 1);
            throw new Error(`Replacement failed. Your previous installation is preserved at ${backup}.`, {
              cause: error
            });
          }
        }
        throw error;
      }
      completed.push(plan.path);
    }
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
    if (completed.length) {
      failure = new Error(`Installation partially completed at ${completed.join(', ')}. ${failure.message}`, {
        cause: failure
      });
    }
  }
  const cleanupErrors: Error[] = [];
  for (const path of [...stages, ...locks]) {
    try {
      await rm(path, { recursive: true, force: true });
    } catch (error) {
      cleanupErrors.push(
        new Error(`Cleanup failed for ${path}: ${error instanceof Error ? error.message : String(error)}`, {
          cause: error
        })
      );
    }
  }
  if (cleanupErrors.length) {
    throw new AggregateError(
      failure ? [failure, ...cleanupErrors] : cleanupErrors,
      `${failure?.message ?? 'Installation completed, but cleanup failed.'}\n${cleanupErrors.map((error) => error.message).join('\n')}`,
      { cause: failure }
    );
  }
  if (failure) throw failure;
  return plans.map(({ path, agents, status }) => ({ path, agents, status }));
};
