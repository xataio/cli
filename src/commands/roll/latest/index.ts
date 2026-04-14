import { buildRouteMap } from '@stricli/core';
import { RollLatestMigrationCommand } from './migration';
import { RollLatestSchemaCommand } from './schema';

export const RollLatestRoute = buildRouteMap({
  docs: {
    brief: 'Print the name of the latest schema version or migration'
  },
  routes: {
    migration: RollLatestMigrationCommand,
    schema: RollLatestSchemaCommand
  }
});
