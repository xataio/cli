#!/usr/bin/env node
import { run } from '@stricli/core';
import dotenv from '@dotenvx/dotenvx';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { buildContext } from '~/context';
import { getCanonicalCommandId } from '~/lib/canonical-command-id';
import { app } from '../app';
dotenv.config({
  debug: Boolean(Bun.env.DEBUG),
  path: path.join(__dirname, '../../', '.env.local'),
  quiet: true,
  ignore: ['MISSING_ENV_FILE']
});

const cliInvocationId = randomUUID();

await run(app, process.argv.slice(2), {
  process,
  forCommand: async (info) => {
    const canonicalName = getCanonicalCommandId(app, info.prefix);
    const context = await buildContext(process, { canonicalName, cliInvocationId });

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
