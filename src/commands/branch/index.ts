import { buildRouteMap } from '@stricli/core';
import { PRODUCT_NAME } from '~/lib/constants';
import { BranchCheckoutCommand } from './checkout';
import { BranchCreateCommand } from './create';
import { BranchDeleteCommand } from './delete';
import { BranchDescribeCommand } from './describe';
import { BranchGetCommand } from './get';
import { BranchListCommand } from './list';
import { BranchLogsCommand } from './logs';
import { BranchMetricsCommand } from './metrics';
import { BranchSetCommand } from './set';
import { BranchTreeCommand } from './tree';
import { BranchRotatePasswordCommand } from './rotate-password';
import { BranchURLCommand } from './url';
import { BranchWaitReadyCommand } from './wait-ready';
import { BranchQueryInsightsRoute } from './query-insights';

export const BranchRoute = buildRouteMap({
  docs: {
    brief: `Create, list, and manage ${PRODUCT_NAME} branches`,
    fullDescription:
      'A branch is a running Postgres database. Creating one copies the data of its parent, and the branch checked out in this folder is the one commands act on when no branch is given.',
    hideRoute: {}
  },
  routes: {
    list: BranchListCommand,
    describe: BranchDescribeCommand,
    create: BranchCreateCommand,
    delete: BranchDeleteCommand,
    logs: BranchLogsCommand,
    url: BranchURLCommand,
    checkout: BranchCheckoutCommand,
    tree: BranchTreeCommand,
    get: BranchGetCommand,
    metrics: BranchMetricsCommand,
    set: BranchSetCommand,
    'rotate-password': BranchRotatePasswordCommand,
    'wait-ready': BranchWaitReadyCommand,
    'query-insights': BranchQueryInsightsRoute
  },
  aliases: {
    ls: 'list',
    view: 'describe',
    show: 'describe',

    'connection-string': 'url',

    topology: 'tree',
    qi: 'query-insights'
  }
});
