#!/usr/bin/env node
import { run } from '@stricli/core';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { buildContext } from '~/context';
import { getCanonicalCommandId } from '~/lib/canonical-command-id';
import { getDebugFlag, getJsonFlag } from '~/lib/global-flags';
import { loadEnvFile } from '~/lib/load-env-file';
import { getProfileFlag } from '~/lib/profile';
import { app } from '../app';
loadEnvFile(path.join(__dirname, '../../', '.env.local'));

const cliInvocationId = randomUUID();

await run(app, process.argv.slice(2), {
  process,
  forCommand: async (info) => {
    const canonicalName = getCanonicalCommandId(app, info.prefix);
    const profile = getProfileFlag(process.argv.slice(2));
    const debug = getDebugFlag(process.argv.slice(2)) || Boolean(Bun.env.DEBUG);
    const json = getJsonFlag(process.argv.slice(2));
    const context = await buildContext(process, { canonicalName, cliInvocationId, profile, debug, json });

    if (context.usingEnvApiKey && !context.debug) {
      process.on('exit', (code) => {
        if (code !== 0) {
          process.stderr.write('Note: Using XATA_API_KEY from environment variable.\n');
        }
      });
    }

    return context;
  }
});
