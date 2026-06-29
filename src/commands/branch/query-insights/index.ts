import { buildRouteMap } from '@stricli/core';
import { QueryInsightsActiveCommand } from './active';
import { QueryInsightsEnableCommand } from './enable';
import { QueryInsightsListCommand } from './list';
import { QueryInsightsResetCommand } from './reset';
import { QueryInsightsShowCommand } from './show';

export const BranchQueryInsightsRoute = buildRouteMap({
  docs: {
    brief: 'Inspect query statistics and active queries for a branch'
  },
  routes: {
    list: QueryInsightsListCommand,
    show: QueryInsightsShowCommand,
    active: QueryInsightsActiveCommand,
    enable: QueryInsightsEnableCommand,
    reset: QueryInsightsResetCommand
  },
  aliases: {
    ls: 'list',
    get: 'show'
  },
  defaultCommand: 'list'
});
