import { buildRouteMap } from '@stricli/core';
import { SkillInstallCommand } from './install';
import { SkillListCommand } from './list';

export const SkillRoute = buildRouteMap({
  docs: { brief: 'Discover and install Xata agent skills' },
  routes: { list: SkillListCommand, install: SkillInstallCommand }
});
