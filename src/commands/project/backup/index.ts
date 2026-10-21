import { buildRouteMap } from '@stricli/core';
import { PRODUCT_NAME } from '~/lib/constants';
import { BackupStatusCommand } from './status';
import { BackupConfigureCommand } from './configure';
import { BackupDescribeCommand } from './describe';

export const ProjectBackupRoute = buildRouteMap({
  docs: {
    brief: `List and manage ${PRODUCT_NAME} project backups`
  },
  routes: {
    status: BackupStatusCommand,
    describe: BackupDescribeCommand,
    configure: BackupConfigureCommand
  },
  aliases: {
    list: 'status',
    ls: 'status',
    get: 'describe'
  }
});
