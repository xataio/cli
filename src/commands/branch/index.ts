import { buildRouteMap } from '@stricli/core';
import { CLI_NAME } from '~/lib/constants';
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

export const BranchRoute = buildRouteMap({
  docs: {
    brief: `Create, list, and manage ${CLI_NAME} branches`,
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
    'wait-ready': BranchWaitReadyCommand
  },
  aliases: {
    ls: 'list',
    view: 'describe',
    show: 'describe',

    'connection-string': 'url',

    topology: 'tree'
  }
});
