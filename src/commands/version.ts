import { buildCommand } from '@stricli/core';

import type { LocalContext } from '~/context';
import { getCurrentVersion } from '~/lib/binary/utils';
import { CLI_NAME, PRODUCT_NAME } from '~/lib/constants';
import { getPgRoll } from '~/lib/pgroll/binary';
import { getPgStream } from '~/lib/pgstream/binary';
import { getCLIVersion } from '~/lib/updates';

type Flags = {
  'skip-download': boolean;
};

export async function implementation(this: LocalContext, { 'skip-download': skipDownload }: Flags) {
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
  // The compiled CLI *is* the Bun runtime, so `Bun.version` is the exact version
  // of the statically linked JavaScriptCore/WebKit (and tinycc) embedded in this
  // binary. Surfaced here so the LGPL corresponding-source revision is
  // unambiguous (see the NOTICE / `xata licenses`).
  const bunVersion = Bun.version;

  this.printDetails(this, { CLIVersion, pgrollVersion, pgstreamVersion, bunVersion }, [
    [CLI_NAME, CLIVersion],
    ['pgroll', pgrollVersion ?? 'unknown'],
    ['pgstream', pgstreamVersion ?? 'unknown'],
    ['bun runtime', bunVersion]
  ]);
}

export const VersionCommand = buildCommand({
  docs: {
    brief: `Get the version of the ${PRODUCT_NAME} CLI, pgroll and pgstream`
  },
  parameters: {
    flags: {
      'skip-download': {
        kind: 'boolean',
        brief: 'Skip downloading the pgroll/pgstream binaries',
        default: false
      }
    }
  },
  func: implementation
});
