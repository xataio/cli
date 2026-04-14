import { buildRouteMap } from '@stricli/core';
import { IpFilterListCommand } from './list';
import { IpFilterEnableCommand } from './enable';
import { IpFilterDisableCommand } from './disable';
import { IpFilterAddCommand } from './add';
import { IpFilterRemoveCommand } from './remove';

export const ProjectIpFilterRoute = buildRouteMap({
  docs: {
    brief: 'Manage IP filtering for a project'
  },
  routes: {
    list: IpFilterListCommand,
    enable: IpFilterEnableCommand,
    disable: IpFilterDisableCommand,
    add: IpFilterAddCommand,
    remove: IpFilterRemoveCommand
  },
  defaultCommand: 'list'
});
