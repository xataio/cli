import { buildCommand } from '@stricli/core';
import chalk from 'chalk';
import { render } from 'ink';
import React from 'react';
import { ConsoleApp } from '~/console/app';
import { runScratchHandoff } from '~/console/scratch-handoff';
import type { ConsoleFlags, ConsoleHandoff, ConsoleHandoffRequest, ViewId } from '~/console/types';
import type { LocalContext } from '~/context';
import { getErrorMessage } from '~/lib/cli-utils';
import { resolveExecutable, runInteractivePostgresCommand } from '~/lib/scratch-session';

export async function implementation(this: LocalContext, flags: ConsoleFlags) {
  if (!this.isInteractive || !this.process.stdin.isTTY || !this.process.stdout.isTTY) {
    this.process.stderr.write(
      '`xata console` requires an interactive terminal. Use `xata branch describe` or `xata branch url` in non-interactive environments.\n'
    );
    this.process.exit(1);
  }

  let currentFlags = { ...flags };
  let initialView: ViewId | undefined;

  while (true) {
    let request: ConsoleHandoffRequest | undefined;
    const app = render(
      React.createElement(ConsoleApp, {
        context: this,
        flags: currentFlags,
        initialView,
        onHandoff: (handoffRequest: ConsoleHandoffRequest) => {
          request = handoffRequest;
        }
      })
    );
    await app.waitUntilExit();
    if (!request) return;

    app.clear();
    currentFlags = {
      ...currentFlags,
      organization: request.resume.organizationId,
      project: request.resume.projectId,
      branch: request.resume.branchId,
      database: request.resume.database,
      type: request.resume.type
    };
    initialView = request.resume.view;

    try {
      await runHandoff(this, request.handoff);
    } catch (error) {
      this.process.stderr.write(chalk.red(`${getErrorMessage(error)}\n`));
    }
  }
}

async function runHandoff(context: LocalContext, handoff: ConsoleHandoff) {
  const psql = resolveExecutable(context, 'psql');
  if (!psql) {
    context.process.stderr.write(chalk.red('psql not found in PATH.\n'));
    return;
  }

  if (handoff.kind === 'psql') {
    context.process.stderr.write(
      chalk.gray(`Connecting psql to ${handoff.branchName}. Quit psql (\\q) to return to the console.\n`)
    );
    await runInteractivePostgresCommand(context, psql, [], handoff.connectionString, handoff.database);
    return;
  }

  await runScratchHandoff(context, handoff, psql);
}

export const ConsoleCommand = buildCommand({
  docs: {
    brief: 'Open an interactive branch console'
  },
  parameters: {
    flags: {
      organization: {
        kind: 'parsed',
        brief: 'Organization ID',
        parse: String,
        optional: true
      },
      project: {
        kind: 'parsed',
        brief: 'Project ID',
        parse: String,
        optional: true
      },
      branch: {
        kind: 'parsed',
        brief: 'Branch ID',
        parse: String,
        optional: true
      },
      database: {
        kind: 'parsed',
        brief: 'Database name',
        parse: String,
        optional: true
      },
      type: {
        kind: 'enum',
        values: ['primary', 'primary-or-replica', 'replica', 'pooler'],
        brief:
          'Connection type: primary (direct access to the primary), primary-or-replica (routed access to primary or replicas), replica (read-only access to replicas only), pooler (pooled access to the primary)',
        default: 'primary'
      }
    }
  },
  func: implementation
});
