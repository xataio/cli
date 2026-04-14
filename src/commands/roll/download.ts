import { buildCommand } from '@stricli/core';
import type { LocalContext } from '~/context';
import { getPgRoll } from '~/lib/pgroll/binary';

export async function implementation(this: LocalContext) {
  const pgrollPath = await getPgRoll(this);
  this.process.stdout.write(`pgroll binary downloaded to ${pgrollPath}\n`);
}

export const RollDownloadCommand = buildCommand({
  docs: {
    brief: 'Download the pgroll binary'
  },
  parameters: {},
  func: implementation
});
