import fs from 'node:fs';
import { parseEnv } from 'node:util';

export function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(filePath, 'utf8')))) {
    Bun.env[key] ??= value;
  }
}
