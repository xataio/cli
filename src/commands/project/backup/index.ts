import { buildRouteMap } from '@stricli/core';
import { CLI_NAME } from '~/lib/constants';
import { BackupListCommand } from './list';
import { BackupConfigureCommand } from './configure';
import { BackupDescribeCommand } from './describe';

export const ProjectBackupRoute = buildRouteMap({
  docs: {
    brief: `List and manage ${CLI_NAME} project backups`
  },
  routes: {
    list: BackupListCommand,
    describe: BackupDescribeCommand,
    configure: BackupConfigureCommand
  },
  aliases: {
    ls: 'list',
    get: 'describe'
  }
});
