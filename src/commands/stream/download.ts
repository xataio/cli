import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { getPgStream } from '~/lib/pgstream/binary';

export async function implementation(this: LocalContext) {
  const pgstreamPath = await getPgStream(this);
  this.process.stdout.write(`pgstream binary downloaded to ${pgstreamPath}\n`);
}

export const StreamDownloadCommand = buildCommand({
  docs: {
    brief: 'Download the pgstream binary'
  },
  parameters: {},
  func: implementation
});
