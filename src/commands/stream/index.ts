import { buildRouteMap } from '@stricli/core';

import { StreamDownloadCommand } from './download';
import { StreamDestroyCommand } from './destroy';

export const StreamRoute = buildRouteMap({
  docs: {
    brief: 'Run pgstream to stream PostgreSQL data to another destination',
    fullDescription:
      'The pgstream binary version is pinned by the CLI and can be overridden with the `XATA_PGSTREAM_BINARY_VERSION` environment variable.',
    hideRoute: {
      download: true
    }
  },
  routes: {
    download: StreamDownloadCommand,
    destroy: StreamDestroyCommand
  }
});
