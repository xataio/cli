import { buildCommand } from '@stricli/core';

import type { LocalContext } from '~/context';
import { PRODUCT_NAME } from '~/lib/constants';
// Embedded at compile time via Bun's text loader so the notices travel *inside*
// the standalone binary (the distributed artifact), satisfying the LGPL
// attribution requirement for the statically linked JavaScriptCore/WebKit and
// tinycc components. See the NOTICE file for details.
import noticeText from '../../NOTICE' with { type: 'text' };
import lgplText from '../../licenses/LGPL-2.1.txt' with { type: 'text' };

type Flags = {
  full: boolean;
};

export async function implementation(this: LocalContext, { full }: Flags) {
  const write = (s: string) => this.process.stdout.write(s.endsWith('\n') ? s : `${s}\n`);
  write(noticeText);
  if (full) {
    write('\n' + '='.repeat(80) + '\n');
    write(lgplText);
  }
}

export const LicensesCommand = buildCommand({
  docs: {
    brief: `Show third-party software notices and licenses bundled with the ${PRODUCT_NAME} CLI`,
    fullDescription:
      'Prints the NOTICE bundled with the CLI, which identifies the statically linked ' +
      'LGPL components (JavaScriptCore/WebKit, tinycc) embedded via the Bun runtime and how to ' +
      'obtain their corresponding source and relink. Use --full to also print the full LGPL-2.1 text.'
  },
  parameters: {
    flags: {
      full: {
        kind: 'boolean',
        brief: 'Also print the full text of the GNU LGPL-2.1 license',
        default: false
      }
    }
  },
  func: implementation
});
