import dedent from 'dedent';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CLI_NAME } from './constants';
import { env } from './env';

const DOT_GITIGNORE = dedent`
  project.json
  branch.json
`;

/** Both project.json and branch.json live here, next to the folder the project is linked to. */
export function getLocalConfigDir() {
  return path.resolve(env.XATA_CONFIG_DIR || process.cwd(), `.${CLI_NAME}`);
}

/**
 * Creates the local config directory and, the first time, the .gitignore for it. Every command
 * that writes the config goes through here, so a branch checked out by a build is ignored the
 * same way one written by `init` is.
 */
export async function ensureLocalConfigDir() {
  const dir = getLocalConfigDir();
  await mkdir(dir, { recursive: true });

  const gitignore = path.join(dir, '.gitignore');
  if (!existsSync(gitignore)) {
    await writeFile(gitignore, DOT_GITIGNORE);
  }

  return dir;
}
