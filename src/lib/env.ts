/* biome-ignore-all lint/style/noProcessEnv: It's correct to access environment variables here */

import { z } from 'zod';

import dotenv from '@dotenvx/dotenvx';
import path from 'node:path';
dotenv.config({
  debug: Boolean(Bun.env.DEBUG),
  path: path.join(__dirname, '../../', '.env.local'),
  quiet: true,
  ignore: ['MISSING_ENV_FILE']
});

const schema = z.object({
  // System environment variables
  NODE_ENV: z.string().optional(),
  XDG_CONFIG_HOME: z.string().optional(),
  HOME: z.string().optional(),
  APPDATA: z.string().optional(),

  // Xata environment variables
  XATA_CONFIG_DIR: z.string().optional(),
  XATA_API_KEY: z.string().optional(),
  XATA_API_BASE_URL: z.string().optional(),
  XATA_API_ISSUER: z.string().optional(),
  XATA_API_CLIENT_SECRET: z.string().optional(),
  XATA_API_CLIENT_ID: z.string().optional(),

  XATA_PGROLL_BINARY_VERSION: z.string().optional(),
  XATA_PGSTREAM_BINARY_VERSION: z.string().optional(),

  XATA_CLI_SOURCE_POSTGRES_URL: z.string().optional(),
  XATA_PRIVATE_BRANCH_TIMEOUT: z.string().default('1000'),

  ANTHROPIC_API_KEY: z.string().optional()
});

export const env = schema.parse(process.env);

export function loadEnvConfig(keys: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const key of keys) {
    if (process.env[`XATA_${key.toUpperCase()}`]) {
      result[key] = process.env[`XATA_${key.toUpperCase()}`]!;
    }
  }

  return result;
}
