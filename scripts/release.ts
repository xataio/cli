import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { match } from 'ts-pattern';
import { CLI_NAME } from '~/lib/constants';
import { BUCKET_NAME } from '~/lib/updates';

// TODO(env): move all instances of process.env to typed env

const REGION = 'us-east-1';
const s3 = new S3Client({ region: REGION });

const DIST_FOLDER = 'dist/';

const channel = process.env.CHANNEL;
if (!channel) {
  throw new Error('Environment variable $CHANNEL is not set');
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const prNumber = process.env.GITHUB_REF_NAME?.replace('/merge', '');
const version = match(channel)
  .with('dev', () => `0.0.0-${prNumber}`)
  .otherwise(() => packageJson.version);

console.log(`🚀 Releasing version ${version} to channel: ${channel}`);

async function uploadFile(filePath: string, s3Path: string) {
  if (process.env.DEBUG === '1') {
    console.log({ filePath, s3Path });
  }
  const fileContent = fs.readFileSync(filePath);
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Path,
    Body: fileContent,
    ACL: 'public-read'
  });

  await s3.send(command);
  console.log(`✅ Uploaded: ${s3Path}`);
}

function generateChecksum(filePath: string) {
  try {
    execSync(`chmod +r "${filePath}"`);
  } catch (_error) {}
  return execSync(`shasum -a 256 "${filePath}"`).toString().split(' ')[0];
}

// Legal/attribution files that must accompany the distributed binaries
// (LGPL-2.1 notice + license for the statically linked JavaScriptCore/WebKit
// and tinycc components embedded via the Bun runtime). These are also embedded
// inside each binary and printable via `xata licenses`, but we publish them
// next to the artifacts as well so they are available without running the CLI.
const LEGAL_FILES = ['NOTICE', 'LICENSE', 'licenses/LGPL-2.1.txt'];

async function uploadLegalFiles(version: string, channel: string | undefined): Promise<Record<string, string>> {
  const uploaded: Record<string, string> = {};
  for (const file of LEGAL_FILES) {
    if (!fs.existsSync(file)) {
      throw new Error(`Required legal file is missing: ${file}`);
    }
    const key = `versions/${version}-${channel}/${file}`;
    await uploadFile(file, key);
    uploaded[file] = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
  }
  return uploaded;
}

async function createManifest() {
  const files = fs.readdirSync(DIST_FOLDER);
  const targets: Record<string, any> = {};

  for (const file of files) {
    const platform = file.replace(new RegExp(`^${CLI_NAME}-`), '').replace(/\.tar\.gz$/, '');
    if (process.env.DEBUG === '1') {
      console.log({ platform });
    }
    const filePath = path.join(DIST_FOLDER, file);
    const s3Key = `versions/${version}-${channel}/${file}`;
    const checksum = generateChecksum(filePath);

    await uploadFile(filePath, s3Key);

    targets[platform] = {
      url: `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`,
      sha256sum: checksum
    };
  }

  const gitSha = process.env.GITHUB_SHA || 'unknown';
  const prLink =
    process.env.GITHUB_REPOSITORY && process.env.GITHUB_REF_NAME
      ? `https://github.com/${process.env.GITHUB_REPOSITORY}/pull/${process.env.GITHUB_REF_NAME}`
      : '';

  const notices = await uploadLegalFiles(version, channel);

  // The binaries are built with `bun build --compile` by this same Bun, so this
  // is the Bun runtime version embedded in them — and therefore the exact
  // JavaScriptCore/WebKit (LGPL) revision shipped. Recorded for LGPL
  // corresponding-source traceability (see NOTICE).
  const bunVersion = Bun.version;

  const manifest = {
    version,
    channels: [channel],
    targets,
    notices,
    bunVersion,
    gitSha,
    prLink
  };

  if (process.env.DEBUG === '1') {
    console.log(JSON.stringify({ manifest }, null, 2));
  }
  const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2));
  fs.writeFileSync(`dist/manifest.json`, manifestBuffer);

  const manifestPath = `versions/${version}-${channel}/manifest.json`;
  await uploadFile('dist/manifest.json', manifestPath);

  const channelManifestPath = `channels/${channel}/manifest.json`;
  await uploadFile('dist/manifest.json', channelManifestPath);

  console.log(`📄 Manifest updated for ${channel}`);
}

createManifest()
  .then(() => {
    console.log('🚀 Release complete!');
  })
  .catch((error) => {
    console.error('❌ Release failed:', error);
    process.exit(1);
  });
