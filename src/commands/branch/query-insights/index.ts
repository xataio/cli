import { buildRouteMap } from '@stricli/core';
import { QueryInsightsActiveCommand } from './active';
import { QueryInsightsEnableCommand } from './enable';
import { QueryInsightsListCommand } from './list';
import { QueryInsightsResetCommand } from './reset';
import { QueryInsightsShowCommand } from './show';

export const BranchQueryInsightsRoute = buildRouteMap({
  docs: {
    brief: 'Inspect query statistics and active queries for a branch',
    fullDescription:
      'Which statements are slow, which are expensive, and what is running right now. Historical statistics come from `pg_stat_statements`, and the queries running at this moment from `pg_stat_activity`. Running `xata branch qi` without a subcommand is the same as `xata branch qi list`. Except for `active`, which reads `pg_stat_activity`, these commands need `pg_stat_statements` loaded: run `xata branch query-insights enable <branch>` and then wait for the restart with `xata branch wait-ready <branch> --wake`. Unlike `logs` and `metrics`, which go through the API, these commands open a direct PostgreSQL connection: they cannot run against a branch that is hibernated or still provisioning, and an API key needs the `credentials:read` scope. The console reads the same `pg_stat_statements` data, see https://xata.io/docs/platform/query-insights.'
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
