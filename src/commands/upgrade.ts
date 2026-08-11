import { buildCommand } from '@stricli/core';
import os from 'node:os';
import type { LocalContext } from '~/context';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { match } from 'ts-pattern';
import { CLI_NAME, PRODUCT_NAME } from '~/lib/constants';
import { downloadToBuffer } from '~/lib/download';
import { BUCKET_NAME, CLI_PATH } from '~/lib/updates';
import { getPgRoll } from '~/lib/pgroll/binary';
import { getPgStream } from '~/lib/pgstream/binary';

type Flags = {
  channel: 'dev' | 'next' | 'latest';
  version?: string;
};

function getPlatform() {
  const platform = os.platform();
  const arch = os.arch();
  const target = `${platform}-${arch}`;
  return target;
}

function verifyChecksum(data: Buffer, sha256sum: string) {
  const hash = crypto.createHash('sha256');
  hash.update(data);
  const calculatedHash = hash.digest('hex');
  if (calculatedHash !== sha256sum) {
    throw new Error('SHA256 checksum verification failed');
  }
}

async function ensureSubBinaries(context: LocalContext): Promise<void> {
  await getPgRoll(context).catch((error) => {
    console.warn(`Warning: Failed to download pgroll binary: ${error.message}`);
  });
  await getPgStream(context).catch((error) => {
    console.warn(`Warning: Failed to download pgstream binary: ${error.message}`);
  });
}

async function checkExistingBinaryChecksum(filePath: string, expectedChecksum: string): Promise<boolean> {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const data = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(data);
  const calculatedHash = hash.digest('hex');

  return calculatedHash === expectedChecksum;
}

export async function implementation(this: LocalContext, flags: Flags) {
  const platform = getPlatform();
  const version = flags.version;
  const channel = flags.channel;

  const checksumUrl = match({ version, channel })
    .with({ version: undefined }, ({ channel }) => {
      return `https://${BUCKET_NAME}.s3.amazonaws.com/channels/${channel}/manifest.json`;
    })
    .otherwise(
      ({ channel, version }) => `https://${BUCKET_NAME}.s3.amazonaws.com/versions/${version}-${channel}/manifest.json`
    );

  const checksumResponse = await fetch(checksumUrl);
  const checksumResponseJson = await checksumResponse.json();
  const target = checksumResponseJson.targets[platform];
  const sha256sum = target.sha256sum;

  const existingChecksum = await checkExistingBinaryChecksum(CLI_PATH, sha256sum);
  if (existingChecksum) {
    console.log('CLI is already up to date.');
    await ensureSubBinaries(this);
    return;
  }

  const binaryData = await downloadToBuffer(target.url, {
    label: `Downloading ${CLI_NAME} CLI`,
    output: this.process.stderr
  });
  verifyChecksum(binaryData, sha256sum);

  const destDir = path.dirname(CLI_PATH);
  fs.mkdirSync(destDir, { recursive: true });
  const tempPath = path.join(destDir, `.cli-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tempPath, binaryData);

  fs.renameSync(tempPath, CLI_PATH);
  fs.chmodSync(CLI_PATH, '755');

  await ensureSubBinaries(this);
  console.log('CLI has been upgraded successfully.');
}

export const UpgradeCommand = buildCommand({
  docs: {
    brief: `Upgrade the ${PRODUCT_NAME} CLI`,
    customUsage: [
      { input: '--version 1.5.4', brief: 'Move to a specific version' },
      { input: '--channel next', brief: 'Follow the pre-release channel' }
    ]
  },
  parameters: {
    flags: {
      channel: {
        kind: 'enum',
        values: ['dev', 'next', 'latest'],
        brief: 'The channel to upgrade from',
        default: 'latest'
      },
      version: {
        kind: 'parsed',
        parse: String,
        brief: 'The version to upgrade to',
        optional: true
      }
    }
  },
  func: implementation
});
