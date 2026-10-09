import { buildCommand } from '@stricli/core';

import type { LocalContext } from '~/context';
import { PRODUCT_NAME } from '~/lib/constants';
import gpl20Text from '../../licenses/GPL-2.0.txt' with { type: 'text' };
import lgpl20Text from '../../licenses/LGPL-2.0.txt' with { type: 'text' };
import lgpl21Text from '../../licenses/LGPL-2.1.txt' with { type: 'text' };
import noticeText from '../../NOTICE' with { type: 'text' };

type Flags = {
  full: boolean;
};

export async function implementation(this: LocalContext, { full }: Flags) {
  if (this.outputJson) {
    this.printTable(this, {
      notice: noticeText,
      ...(full && { 'LGPL-2.0': lgpl20Text, 'LGPL-2.1': lgpl21Text, 'GPL-2.0': gpl20Text })
    });
    return;
  }
  this.process.stdout.write(noticeText);
  if (full) {
    for (const text of [lgpl20Text, lgpl21Text, gpl20Text]) {
      this.process.stdout.write(`\n${'='.repeat(80)}\n${text}`);
    }
  }
}

export const LicensesCommand = buildCommand({
  docs: {
    brief: `Show third-party software notices and licenses bundled with the ${PRODUCT_NAME} CLI`,
    fullDescription:
      'Prints the NOTICE bundled with the CLI, which identifies the statically linked ' +
      'LGPL components (JavaScriptCore/WebKit, tinycc) embedded via the Bun runtime and how to ' +
      'obtain their corresponding source and relink. Use --full to also print the full license texts.'
  },
  parameters: {
    flags: {
      full: {
        kind: 'boolean',
        brief: 'Also print the full texts of the GNU LGPL-2.0, LGPL-2.1 and GPL-2.0 licenses',
        default: false
      }
    }
  },
  func: implementation
});
