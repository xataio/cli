import { buildRouteMap } from '@stricli/core';
import { PRODUCT_NAME } from '~/lib/constants';
import { GenerateSQLCommand } from './sql';
import { AiDownloadRoute } from './download';

export const AiRoute = buildRouteMap({
  docs: {
    brief: `Ask AI to generate, fix and update SQL with ${PRODUCT_NAME}`
  },
  routes: {
    sql: GenerateSQLCommand,
    download: AiDownloadRoute
  }
});
