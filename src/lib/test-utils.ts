import chalk from 'chalk';
import dotenv from '@dotenvx/dotenvx';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import invariant from 'tiny-invariant';
import type { LocalContext } from '~/context';
import { getApi } from './api';
import { getBranch, getDatabase, getOrganization, getProject, print } from './cli-utils';
import { confirmPrompt, datePrompt, inputPrompt, multiselectPrompt, selectPrompt } from './enquirer';
import { env } from './env';
import { getActiveProfile } from './profile';
dotenv.config({
  debug: Boolean(Bun.env.DEBUG),
  path: path.join(__dirname, '../../', '.env.local'),
  quiet: true,
  ignore: ['MISSING_ENV_FILE']
});

invariant(Bun.env.XATA_API_KEY, `XATA_API_KEY is not set. Tests are to be run with env vars.`);

if (Bun.env.DEBUG) {
  console.warn(chalk.red(`DEBUG is set. Since there is more output in the console with debug. Some tests will fail.`));
}

export const TEST_XATA_ORG = 'e2e';
export const TEST_XATA_PROJECT_NAME = 'cli-e2e-tests-database';
export const TEST_XATA_PROJECT_ID = 'prj_lj5tgb80p97jv99a7mctcnbbug';
export const TEST_XATA_BRANCH_ID = 'm99irodq5p2crbqt0r939r8nio';
export const TEST_XATA_BRANCH_NAME = 'main';

function createFakeProcess() {
  const fakeProcess = {
    stdout: {
      write: (_data: string) => {}
    },
    stderr: {
      write: (_data: string) => {}
    },
    exit: (_code: number) => {}
  };
  return fakeProcess;
}

export function getNthArgOfNthCall(spy: any, callIndex: number, argIndex: number) {
  return spy.mock.calls[callIndex][argIndex];
}

export async function getTestContext() {
  const xata = await getApi();
  const debug = Boolean(Bun.env.DEBUG);

  const context: LocalContext = {
    api: xata.api,
    refreshToken: xata.refreshToken.bind(xata),
    env,
    // @ts-expect-error
    process: createFakeProcess(),
    os,
    fs,
    path,
    isInteractive: false,
    print,
    getActiveProfile,
    getOrganization,
    getProject,
    getBranch,
    getDatabase,
    enquirer: {
      confirmPrompt,
      selectPrompt,
      inputPrompt,
      multiselectPrompt,
      datePrompt
    },
    debug
  };
  return context;
}
