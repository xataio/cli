import { buildInstallCommand, buildUninstallCommand } from '@stricli/auto-complete';
import { buildRouteMap } from '@stricli/core';
import { CLI_NAME } from '~/lib/constants';

export const CompletionsRoute = buildRouteMap({
  docs: {
    brief: `Install or uninstall completions for the ${CLI_NAME} CLI`
  },
  routes: {
    install: buildInstallCommand(CLI_NAME, { bash: `__${CLI_NAME}_bash_complete` }),
    uninstall: buildUninstallCommand(CLI_NAME, { bash: true })
  }
});
