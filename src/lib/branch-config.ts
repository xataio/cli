import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from 'zod-config';
import { envAdapter } from 'zod-config/env-adapter';
import { jsonAdapter } from 'zod-config/json-adapter';
import { CLI_NAME } from '~/lib/constants';
import { env, loadEnvConfig } from './env';
import { type BranchConfig, BranchConfigSchema } from './schemas';

export const branchConfig = await loadConfig({
  schema: BranchConfigSchema,
  adapters: [
    jsonAdapter({ path: getBranchConfigPath(), silent: true }),
    envAdapter({ customEnv: loadEnvConfig(Object.keys(BranchConfigSchema.shape)) })
  ]
});

export function isBranchInitialized() {
  return Boolean(branchConfig.branchId && branchConfig.branchName && branchConfig.databaseName);
}

export async function updateBranchConfig(newConfig: BranchConfig) {
  if (BranchConfigSchema.safeParse(newConfig).success === false) {
    throw new Error('Invalid config update');
  }

  try {
    await mkdir(getBranchConfigDir(), { recursive: true });
    await writeFile(getBranchConfigPath(), JSON.stringify(newConfig, null, 2));
  } catch (error: any) {
    throw new Error(`Failed to update config file: ${error.message}`);
  }
}

export function getBranchConfigPath() {
  return path.resolve(getBranchConfigDir(), 'branch.json');
}

export function getBranchConfigDir() {
  return path.resolve(env.XATA_CONFIG_DIR || getDefaultConfigDir(), `.${CLI_NAME}`);
}

function getDefaultConfigDir() {
  return process.cwd();
}
