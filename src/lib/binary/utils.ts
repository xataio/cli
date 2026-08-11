import chalk from 'chalk';
import dedent from 'dedent';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { Socket } from 'node:net';
import os from 'node:os';
import { join } from 'node:path';
import { match } from 'ts-pattern';
import type { LocalContext } from '~/context';
import { getConfigDir } from '../config';
import { downloadToFile } from '../download';
import { fetchBranchCredentials } from '@xata.io/sql';

const CONFIG_DIR = getConfigDir();
const BIN_DIR = join(CONFIG_DIR, 'bin');

export async function downloadBinary(
  tag: string,
  binaryName: string,
  releasesListUrl: string,
  binaryPath: string,
  output: NodeJS.WritableStream
): Promise<void> {
  const vTag = `v${tag}`;
  const osPlatform = os.platform();
  const osArch = os.arch();

  let assetName = '';
  if (osPlatform === 'linux') {
    assetName = osArch === 'x64' ? `${binaryName}.linux.amd64` : `${binaryName}.linux.arm64`;
  } else if (osPlatform === 'darwin') {
    assetName = osArch === 'x64' ? `${binaryName}.macos.amd64` : `${binaryName}.macos.arm64`;
  } else if (osPlatform === 'win32') {
    assetName = `${binaryName}.win.amd64.exe`;
  } else {
    throw new Error(`Unsupported platform: ${osPlatform} ${osArch}`);
  }

  if (!assetName) {
    throw new Error('Could not determine the appropriate binary to download.');
  }

  const releaseData = await fetchReleaseData(releasesListUrl);
  const release = releaseData.find((release: any) => release.tag_name === vTag);
  if (!release) {
    throw new Error(`Release ${vTag} not found.`);
  }
  const downloadUrl = release.assets.find((asset: any) => asset.name === assetName)?.browser_download_url;

  if (!downloadUrl) {
    throw new Error(`Binary for ${osPlatform} ${osArch} not found in the latest release.`);
  }

  // Create directories if necessary
  if (!existsSync(BIN_DIR)) {
    mkdirSync(BIN_DIR, { recursive: true });
  }

  if (osPlatform === 'win32') {
    binaryPath = `${binaryPath}.exe`;
  }

  await downloadToFile(downloadUrl, binaryPath, {
    label: `Downloading ${binaryName} v${tag}`,
    output
  });

  chmodSync(binaryPath, 0o755);
}

async function fetchReleaseData(url: string): Promise<any> {
  const response = await fetch(url, { headers: { 'User-Agent': 'pgstream-helper' } });
  if (!response.ok) {
    throw new Error(`Failed to fetch release data: ${response.statusText}`);
  }
  return response.json();
}

export async function getCurrentVersion(binaryName: 'pgstream' | 'pgroll'): Promise<string | null> {
  try {
    const binaryPath = join(BIN_DIR, binaryName);
    const proc = Bun.spawnSync([binaryPath, '--version']);
    const stdout = await new Response(proc.stdout as BodyInit).text();
    const match = stdout.match(new RegExp(`${binaryName} version (\\S+)`));
    return match?.[1] || null;
  } catch (_error) {
    return null;
  }
}

export async function getBinary(
  context: LocalContext,
  binaryName: 'pgstream' | 'pgroll',
  pinnedBinaryVersion: string
): Promise<string> {
  const releasesListUrl = match(binaryName)
    .with('pgstream', () => 'https://api.github.com/repos/xataio/pgstream/releases')
    .with('pgroll', () => 'https://api.github.com/repos/xataio/pgroll/releases')
    .exhaustive();
  const binaryPath = join(BIN_DIR, binaryName);

  const currentVersion = await getCurrentVersion(binaryName);
  const expectedVersion = match(binaryName)
    .with('pgstream', () => context.env.XATA_PGSTREAM_BINARY_VERSION || pinnedBinaryVersion)
    .with('pgroll', () => context.env.XATA_PGROLL_BINARY_VERSION || pinnedBinaryVersion)
    .exhaustive();

  if (context.debug) {
    context.process.stdout.write(
      `DEBUG: getPgStream: currentVersion=${currentVersion}, expectedVersion=${expectedVersion}\n`
    );
  }

  // Compare versions, if different, download the new binary
  if (expectedVersion !== currentVersion) {
    if (context.debug) {
      if (currentVersion) {
        context.process.stdout.write(
          `pgstream expected version (${expectedVersion}) is different from the current version (${currentVersion}). Downloading...`
        );
      } else {
        context.process.stdout.write(`pgstream is not downloaded. Downloading...`);
      }
    }
    if (expectedVersion === 'development') {
      throw new Error(
        `Expected ${binaryName} version development. Please copy the correct binary version to the ${BIN_DIR} directory`
      );
    } else {
      await downloadBinary(expectedVersion, binaryName, releasesListUrl, binaryPath, context.process.stderr);
    }
    if (context.debug) {
      context.process.stdout.write(`Successfully downloaded pgstream version ${expectedVersion}`);
    }
  }

  return binaryPath;
}

export async function checkBranchIsReachable(
  context: LocalContext,
  flags: {
    organization?: string;
    project?: string;
    branch?: string;
  }
) {
  const organizationId = await context.getOrganization(context, flags, {});
  const projectId = await context.getProject(context, flags, { organizationId });
  const branchId = await context.getBranch(context, flags, { organizationId, projectId });

  const branch = await context.api.branches.describeBranch({
    pathParams: { organizationID: organizationId, projectID: projectId, branchID: branchId }
  });
  if (!branch.publicAccess) {
    const timeout = parseInt(context.env.XATA_PRIVATE_BRANCH_TIMEOUT);
    if (timeout === 0) {
      return;
    }
    const { hostname, port } = await fetchBranchCredentials(context.api, {
      organizationID: organizationId,
      projectID: projectId,
      branchID: branchId
    });
    const reachable = await isPortReachable(hostname, port, timeout);
    if (!reachable) {
      context.process.stderr.write(
        chalk.bold.red(
          dedent(`Private networking only: This branch does not have public internet access.
          Please make sure you are running this command from a machine within the same VPC as the branch.

          Timeout is set to ${context.env.XATA_PRIVATE_BRANCH_TIMEOUT}ms.
          Please set XATA_PRIVATE_BRANCH_TIMEOUT=0 to disable this check.
          `)
        )
      );
      context.process.exit(1);
    }
  }
}

/**
 * pgroll and pgstream describe their flags in lower case and write placeholders
 * bare, the CLI writes them capitalized and as code.
 */
export function toBrief(description: string) {
  // `<schema>.<table>` reads as one placeholder, not as two
  const text = description.replace(/(?<!`)(<[^<>\s]+>(?:[.:/-]?<[^<>\s]+>)*)(?!`)/g, '`$1`');

  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Answers whether a TCP port accepts a connection within `timeout` ms. The socket is destroyed
 * rather than ended on every path: a half-close lingers until the peer closes back, which would
 * hold the process open after the command is done.
 */
export function isPortReachable(host: string, port: number, timeout: number) {
  return new Promise<boolean>((resolve) => {
    const socket = new Socket();
    const settle = (reachable: boolean) => {
      socket.destroy();
      resolve(reachable);
    };

    socket.setTimeout(timeout);
    socket.once('error', () => settle(false));
    socket.once('timeout', () => settle(false));
    socket.connect(port, host, () => settle(true));
  });
}
