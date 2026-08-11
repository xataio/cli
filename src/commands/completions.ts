import { buildInstallCommand, buildUninstallCommand } from '@stricli/auto-complete';
import { buildRouteMap } from '@stricli/core';
import { CLI_NAME, PRODUCT_NAME } from '~/lib/constants';

export const CompletionsRoute = buildRouteMap({
  docs: {
    brief: `Install or uninstall shell completions for the ${PRODUCT_NAME} CLI`,
    fullDescription: 'Only bash is supported, and the completions are picked up the next time the shell starts.'
  },
  routes: {
    install: buildInstallCommand(CLI_NAME, { bash: `__${CLI_NAME}_bash_complete` }),
    uninstall: buildUninstallCommand(CLI_NAME, { bash: true })
  }
});
