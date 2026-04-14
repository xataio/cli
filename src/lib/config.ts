import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { type Adapter, loadConfig } from 'zod-config';
import { jsonAdapter } from 'zod-config/json-adapter';
import { CLI_NAME, DEFAULT_ENVIRONMENT } from './constants';
import { env } from './env';
import { type Config, ConfigSchema } from './schemas';

const envAdapter = () =>
  ({
    name: 'env',
    async read(): Promise<Partial<Config>> {
      const environment = env.XATA_API_ENVIRONMENT || DEFAULT_ENVIRONMENT;

      if (env.XATA_API_KEY) {
        return {
          activeProfile: '__env',
          profiles: {
            __env: {
              type: 'apiKey',
              environment,
              apiKey: env.XATA_API_KEY
            }
          }
        };
      }

      return {};
    }
  }) satisfies Adapter;

export const config = await loadConfig({
  schema: ConfigSchema,
  adapters: [jsonAdapter({ path: getConfigPath(), silent: true }), envAdapter()]
});

export async function updateConfig(newConfig: Config) {
  if (ConfigSchema.safeParse(newConfig).success === false) {
    throw new Error('Invalid config update');
  }

  if (newConfig.activeProfile === '__env') {
    return;
  }

  try {
    await mkdir(getConfigDir(), { recursive: true });
    await writeFile(getConfigPath(), JSON.stringify(newConfig, null, 2));
  } catch (error: any) {
    throw new Error(`Failed to update config file: ${error.message}`);
  }
}

function getConfigPath() {
  return path.resolve(getConfigDir(), 'config.json');
}

export function getConfigDir() {
  return path.resolve(env.XATA_CONFIG_DIR || getDefaultConfigDir(), CLI_NAME);
}

function getDefaultConfigDir() {
  switch (process.platform) {
    case 'win32':
      return env.APPDATA || `${env.HOME}\\AppData\\Roaming`;
    case 'linux':
    case 'darwin':
      return env.XDG_CONFIG_HOME || `${env.HOME}/.config`;
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

export const scaleToZeroChoices = [
  { name: 'true', message: 'Enabled' },
  { name: 'false', message: 'Disabled' }
];

export const timeChoices = [
  { name: '15', message: '15 minutes' },
  { name: '30', message: '30 minutes' },
  { name: '60', message: '60 minutes' },
  { name: '120', message: '120 minutes' },
  { name: '180', message: '180 minutes' }
];

export const validScaleToZeroValues = ['true', 'false'];
export const validInactivityPeriodValues = timeChoices.map((t) => t.name);
