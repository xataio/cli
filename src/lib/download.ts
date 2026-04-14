import { mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createWriteStream } from 'node:fs';

export type DownloadOptions = {
  label: string;
  output: NodeJS.WritableStream;
};

function writeProgress(output: NodeJS.WritableStream, label: string, received: number, total: number) {
  const isTTY = 'isTTY' in output && output.isTTY;
  const progress = received / total;
  const progressBarLength = 20;
  const filledLength = Math.round(progress * progressBarLength);
  const progressBar = '='.repeat(filledLength).padEnd(progressBarLength, ' ');
  const progressPercentage = (progress * 100).toFixed(0);
  const line = `${label} [${progressBar}] ${progressPercentage}%`;

  if (isTTY) {
    output.write(`\r${line}`);
  }
}

function writeComplete(output: NodeJS.WritableStream, label: string) {
  const isTTY = 'isTTY' in output && output.isTTY;
  if (isTTY) {
    output.write(`\r${label} [====================] 100%\n`);
  } else {
    output.write(`${label} done\n`);
  }
}

function writeStart(output: NodeJS.WritableStream, label: string) {
  const isTTY = 'isTTY' in output && output.isTTY;
  if (!isTTY) {
    output.write(`${label}...\n`);
  }
}

async function readStreamWithProgress(
  response: Response,
  label: string,
  output: NodeJS.WritableStream
): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Failed to fetch the binary content.');
  }

  const contentLength = response.headers.get('content-length');
  const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
  const chunks: Uint8Array[] = [];
  let receivedLength = 0;
  let lastPercentage = -1;

  writeStart(output, label);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      receivedLength += value.length;

      if (totalSize > 0) {
        const currentPercentage = Math.floor((receivedLength / totalSize) * 100);
        if (currentPercentage !== lastPercentage) {
          lastPercentage = currentPercentage;
          writeProgress(output, label, receivedLength, totalSize);
        }
      }
    }
  }

  writeComplete(output, label);

  return Buffer.concat(chunks);
}

export async function downloadToBuffer(url: string, options: DownloadOptions): Promise<Buffer> {
  const { label, output } = options;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  return readStreamWithProgress(response, label, output);
}

export async function downloadToFile(url: string, filePath: string, options: DownloadOptions): Promise<void> {
  const { label, output } = options;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  const buffer = await readStreamWithProgress(response, label, output);

  const destDir = dirname(filePath);
  mkdirSync(destDir, { recursive: true });
  const tempPath = join(destDir, `.xata-download-${process.pid}-${Date.now()}`);
  const fileStream = createWriteStream(tempPath);

  await new Promise<void>((resolve, reject) => {
    fileStream.write(buffer, (err) => {
      if (err) return reject(err);
      fileStream.end(() => {
        renameSync(tempPath, filePath);
        resolve();
      });
    });
  });
}
