import { buildInstallCommand, buildUninstallCommand } from '@stricli/auto-complete';
import { buildRouteMap } from '@stricli/core';
import { CLI_NAME, PRODUCT_NAME } from '~/lib/constants';

export const CompletionsRoute = buildRouteMap({
  docs: {
    brief: `Install or uninstall shell completions for the ${PRODUCT_NAME} CLI`,
    fullDescription: 'Completions are written for the shell in use, and are picked up the next time it starts.'
  },
  routes: {
    install: buildInstallCommand(CLI_NAME, { bash: `__${CLI_NAME}_bash_complete` }),
    uninstall: buildUninstallCommand(CLI_NAME, { bash: true })
  }
});
