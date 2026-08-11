import { buildRouteMap } from '@stricli/core';
import { CloneConfigCommand } from './config';
import { CloneStartCommand } from './start';
import { CloneStreamCommand } from './stream';

export const CloneRoute = buildRouteMap({
  docs: {
    brief: 'Clone another PostgreSQL database with anonymization',
    fullDescription:
      'Copies an external PostgreSQL database into a Xata branch, once with `start` or continuously with `stream`, and can anonymize columns on the way in. `config` writes the anonymization rules the other two read.'
  },
  routes: {
    start: CloneStartCommand,
    config: CloneConfigCommand,
    stream: CloneStreamCommand
  }
});
