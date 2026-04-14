import { buildRouteMap } from '@stricli/core';
import { RollBaselineCommand } from './baseline';
import { RollCompleteCommand } from './complete';
import { RollConvertCommand } from './convert';
import { RollDownloadCommand } from './download';
import { RollInitCommand } from './init';
import { RollLatestCommand } from './latest';
import { RollMigrateCommand } from './migrate';
import { RollPullCommand } from './pull';
import { RollRollbackCommand } from './rollback';
import { RollStartCommand } from './start';
import { RollStatusCommand } from './status';
import { RollUpdateCommand } from './update';
import { RollURLCommand } from './url';

export const RollRoute = buildRouteMap({
  docs: {
    brief: 'Run pgroll to manage PostgreSQL schema migrations',
    hideRoute: {
      download: true,
      url: true
    }
  },
  routes: {
    baseline: RollBaselineCommand,
    complete: RollCompleteCommand,
    init: RollInitCommand,
    latest: RollLatestCommand,
    migrate: RollMigrateCommand,
    update: RollUpdateCommand,
    pull: RollPullCommand,
    rollback: RollRollbackCommand,
    start: RollStartCommand,
    status: RollStatusCommand,
    convert: RollConvertCommand,

    download: RollDownloadCommand,
    url: RollURLCommand
  }
});
