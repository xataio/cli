import type { StricliAutoCompleteContext } from '@stricli/auto-complete';
import type { CommandContext } from '@stricli/core';
import type { ApiClient } from '@xata.io/api';
import * as ciInfo from 'ci-info';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import { getApi } from './lib/api';
import {
  getBranch,
  getCheckedOutBranch,
  getDatabase,
  getOrganization,
  getProject,
  getUserInfo,
  print
} from './lib/cli-utils';
import { confirmPrompt, datePrompt, inputPrompt, multiselectPrompt, selectPrompt } from './lib/enquirer';
import { env } from './lib/env';
import { getActiveProfile } from './lib/profile';

export interface LocalContext extends CommandContext, StricliAutoCompleteContext {
  readonly api: ApiClient;
  readonly refreshToken: () => Promise<string>;
  readonly env: typeof env;
  readonly process: NodeJS.Process;
  readonly fs: typeof import('node:fs');
  readonly os: typeof import('node:os');
  readonly path: typeof import('node:path');
  readonly isCI: boolean;
  readonly print: typeof print;
  readonly getActiveProfile: typeof getActiveProfile;
  readonly getOrganization: typeof getOrganization;
  readonly getProject: typeof getProject;
  readonly getBranch: typeof getBranch;
  readonly getCheckedOutBranch: typeof getCheckedOutBranch;
  readonly getDatabase: typeof getDatabase;
  readonly getUserInfo: typeof getUserInfo;
  readonly enquirer: {
    confirmPrompt: typeof confirmPrompt;
    selectPrompt: typeof selectPrompt;
    inputPrompt: typeof inputPrompt;
    multiselectPrompt: typeof multiselectPrompt;
    datePrompt: typeof datePrompt;
  };
  debug: boolean;
  usingEnvApiKey: boolean;

  postgres: (connectionString: string) => postgres.Sql;
}

export async function buildContext(process: NodeJS.Process, canonicalName?: string): Promise<LocalContext> {
  const debug = Boolean(Bun.env.DEBUG);
  const usingEnvApiKey = Boolean(env.XATA_API_KEY);
  const xata = await getApi({ canonicalName });

  if (usingEnvApiKey && debug) {
    process.stderr.write('Using XATA_API_KEY from environment variable.\n');
  }

  return {
    api: xata.api,
    refreshToken: xata.refreshToken.bind(xata),
    env,
    process,
    os,
    fs,
    path,
    isCI: ciInfo.isCI,
    print,
    getActiveProfile,
    getOrganization,
    getProject,
    getBranch,
    getCheckedOutBranch,
    getDatabase,
    getUserInfo,
    enquirer: {
      confirmPrompt,
      selectPrompt,
      inputPrompt,
      multiselectPrompt,
      datePrompt
    },
    debug,
    usingEnvApiKey,
    postgres: (connectionString: string) => {
      const sql = postgres(connectionString);
      return sql;
    }
  };
}
