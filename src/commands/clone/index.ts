import { buildRouteMap } from '@stricli/core';
import { CloneConfigCommand } from './config';
import { CloneStartCommand } from './start';
import { CloneStreamCommand } from './stream';

export const CloneRoute = buildRouteMap({
  docs: {
    brief: 'Clone another PostgreSQL database with anonymization'
  },
  routes: {
    start: CloneStartCommand,
    config: CloneConfigCommand,
    stream: CloneStreamCommand
  }
});
