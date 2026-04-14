import { buildRouteMap } from '@stricli/core';
import { CLI_NAME } from '~/lib/constants';
import { GenerateSQLCommand } from './sql';
import { AiDownloadRoute } from './download';

export const AiRoute = buildRouteMap({
  docs: {
    brief: `Ask AI to generate, fix and update SQL with ${CLI_NAME}`
  },
  routes: {
    sql: GenerateSQLCommand,
    download: AiDownloadRoute
  }
});
