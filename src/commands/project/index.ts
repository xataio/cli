import { buildRouteMap } from '@stricli/core';
import { ProjectBackupRoute } from './backup';
import { ProjectCreateCommand } from './create';
import { ProjectDeleteCommand } from './delete';
import { ProjectDescribeCommand } from './describe';
import { ProjectGetCommand } from './get';
import { ProjectInitCommand } from './init';
import { ProjectIpFilterRoute } from './ip-filter';
import { ProjectListCommand } from './list';
import { ProjectSetCommand } from './set';

export const ProjectRoute = buildRouteMap({
  docs: {
    brief: 'Create, list, and manage projects',
    hideRoute: {
      backup: true
    }
  },
  routes: {
    list: ProjectListCommand,
    describe: ProjectDescribeCommand,
    create: ProjectCreateCommand,
    delete: ProjectDeleteCommand,
    init: ProjectInitCommand,
    get: ProjectGetCommand,
    set: ProjectSetCommand,
    'ip-filter': ProjectIpFilterRoute,
    backup: ProjectBackupRoute
  },
  aliases: {
    ls: 'list',
    view: 'describe',
    show: 'describe',

    connect: 'init',
    switch: 'init',
    link: 'init'
  }
});
