import { buildCommand } from '@stricli/core';

import type { LocalContext } from '~/context';
import { getCurrentVersion } from '~/lib/binary/utils';
import { CLI_NAME, PRODUCT_NAME } from '~/lib/constants';
import { getPgRoll } from '~/lib/pgroll/binary';
import { getPgStream } from '~/lib/pgstream/binary';
import { getCLIVersion } from '~/lib/updates';

type Flags = {
  json: boolean;
  'skip-download': boolean;
};

export async function implementation(this: LocalContext, { json, 'skip-download': skipDownload }: Flags) {
  if (!skipDownload) {
    await getPgRoll(this).catch(
      (e) => this.debug && this.process.stderr.write(`DEBUG: pgroll ensure failed: ${e.message}\n`)
    );
    await getPgStream(this).catch(
      (e) => this.debug && this.process.stderr.write(`DEBUG: pgstream ensure failed: ${e.message}\n`)
    );
  }

  const pgrollVersion = await getCurrentVersion('pgroll');
  const pgstreamVersion = await getCurrentVersion('pgstream');
  const CLIVersion = getCLIVersion();

  this.print(
    this,
    json,
    {
      CLIVersion,
      pgrollVersion,
      pgstreamVersion
    },
    [`${CLI_NAME}`, 'pgroll', 'pgstream'],
    [[CLIVersion, pgrollVersion ?? 'unknown', pgstreamVersion ?? 'unknown']]
  );
}

export const VersionCommand = buildCommand({
  docs: {
    brief: `Get the version of the ${PRODUCT_NAME} CLI, pgroll and pgstream`
  },
  parameters: {
    flags: {
      json: {
        kind: 'boolean',
        brief: 'Output in JSON format',
        default: false
      },
      'skip-download': {
        kind: 'boolean',
        brief: 'Skip downloading the pgroll/pgstream binaries',
        default: false
      }
    }
  },
  func: implementation
});
