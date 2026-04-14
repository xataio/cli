import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from 'zod-config';
import { envAdapter } from 'zod-config/env-adapter';
import { jsonAdapter } from 'zod-config/json-adapter';
import { CLI_NAME } from './constants';
import { env, loadEnvConfig } from './env';
import { type ProjectConfig, ProjectConfigSchema } from './schemas';

export const projectConfig = await loadConfig({
  schema: ProjectConfigSchema,
  adapters: [
    jsonAdapter({ path: getProjectConfigPath(), silent: true }),
    envAdapter({ customEnv: loadEnvConfig(Object.keys(ProjectConfigSchema.shape)) })
  ]
});

export function isProjectInitialized() {
  return Boolean(projectConfig.organizationId && projectConfig.projectId);
}

export async function updateProjectConfig(newConfig: ProjectConfig) {
  if (ProjectConfigSchema.safeParse(newConfig).success === false) {
    throw new Error('Invalid config update');
  }

  try {
    await mkdir(getProjectConfigDir(), { recursive: true });
    await writeFile(getProjectConfigPath(), JSON.stringify(newConfig, null, 2));
  } catch (error: any) {
    throw new Error(`Failed to update config file: ${error.message}`);
  }
}

export function getProjectConfigPath() {
  return path.resolve(getProjectConfigDir(), 'project.json');
}

export function getProjectConfigDir() {
  return path.resolve(env.XATA_CONFIG_DIR || getDefaultConfigDir(), `.${CLI_NAME}`);
}

function getDefaultConfigDir() {
  return process.cwd();
}
