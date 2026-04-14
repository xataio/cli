import dotenv from '@dotenvx/dotenvx';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

dotenv.config({
  debug: Boolean(Bun.env.DEBUG),
  path: path.resolve(import.meta.dir, '../../', '.env.local'),
  quiet: true,
  ignore: ['MISSING_ENV_FILE']
});

type RunResult = {
  code: number;
  stdout: string;
  stderr: string;
};

const CLI_PACKAGE_ROOT = path.resolve(import.meta.dir, '../../');

function getPlatformBinaryName(): string {
  const platform = os.platform();
  const arch = os.arch();
  return `xata-${platform}-${arch}`;
}

function resolveToAbsolute(binaryPath: string): string {
  if (path.isAbsolute(binaryPath)) {
    return binaryPath;
  }
  return path.resolve(CLI_PACKAGE_ROOT, 'dist', binaryPath);
}

function getCliBinaryPath(): string {
  const binaryName = Bun.env.XATA_CLI_UNDER_TEST || getPlatformBinaryName();
  const binaryPath = resolveToAbsolute(binaryName);

  if (!fs.existsSync(binaryPath)) {
    const binaryName = getPlatformBinaryName();
    throw new Error(
      `CLI binary not found at: ${binaryPath}\n\n` +
        `To fix this, build the binary first:\n` +
        `  cd external/xata-cli && bun run build\n\n` +
        `Then run tests with:\n` +
        `  export XATA_CLI_UNDER_TEST=./dist/${binaryName}\n` +
        `  bun test test/e2e`
    );
  }

  console.log(`\n[E2E] Using CLI binary: ${binaryName}\n`);
  return binaryPath;
}

export async function runCli(args: string[]): Promise<RunResult> {
  const binaryPath = getCliBinaryPath();
  const timeoutMs = 10_000;

  const proc = Bun.spawn({
    cmd: [binaryPath, ...args],
    cwd: process.cwd(),
    env: {
      ...Bun.env
    },
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe'
  });

  const timer = setTimeout(() => {
    try {
      proc.kill();
    } catch {}
  }, timeoutMs);

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ]).finally(() => clearTimeout(timer));

  return { code, stdout, stderr };
}
