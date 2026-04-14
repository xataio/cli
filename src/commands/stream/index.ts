import { buildRouteMap } from '@stricli/core';

import { StreamDownloadCommand } from './download';
import { StreamDestroyCommand } from './destroy';

export const StreamRoute = buildRouteMap({
  docs: {
    brief: 'Run pgstream to stream PostgreSQL data to another destination',
    hideRoute: {
      download: true
    }
  },
  routes: {
    download: StreamDownloadCommand,
    destroy: StreamDestroyCommand
  }
});
