import { afterAll, afterEach, describe, expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { downloadToFile } from './download';

const script = '#!/bin/sh\necho downloaded\n';
const server = Bun.serve({
  port: 0,
  fetch: () => new Response(script)
});
const dir = mkdtempSync(join(tmpdir(), 'xata-download-'));
const output = new Writable({ write: (_chunk, _encoding, next) => next() });

afterEach(() => {
  return rmSync(dir, { recursive: true, force: true });
});
afterAll(() => {
  return server.stop(true);
});

/**
 * The runtime releases a write stream's descriptor some time after 'finish'.
 * Stretching that gap makes a download that resolves too early fail every time.
 */
function withDelayedClose() {
  const streams: fs.WriteStream[] = [];
  const realCreateWriteStream = fs.createWriteStream;
  const createWriteStream = spyOn(fs, 'createWriteStream').mockImplementation((path, options) => {
    const stream = realCreateWriteStream(path, options);
    const destroy = stream._destroy.bind(stream);
    stream._destroy = (error, callback) => setTimeout(() => destroy(error, callback), 20);
    streams.push(stream);
    return stream;
  });
  return { streams, restore: () => createWriteStream.mockRestore() };
}

describe('downloadToFile', () => {
  test('resolves only once the file is closed, so it can be executed at once', async () => {
    const { streams, restore } = withDelayedClose();
    try {
      const filePath = join(dir, 'binary');
      await downloadToFile(`http://localhost:${server.port}/binary`, filePath, { label: 'test', output });

      expect(streams).toHaveLength(1);
      expect(streams[0]?.closed).toBe(true);
      expect(readdirSync(dir)).toEqual(['binary']);
      fs.chmodSync(filePath, 0o755);
      const proc = Bun.spawnSync([filePath]);
      expect(proc.stdout.toString()).toBe('downloaded\n');
    } finally {
      restore();
    }
  });
});
