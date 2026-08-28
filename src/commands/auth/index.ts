import { buildRouteMap } from '@stricli/core';
import { PRODUCT_NAME } from '~/lib/constants';
import { AuthAccessTokenCommand } from './access-token';
import { AuthListCommand } from './list';
import { AuthLoginCommand } from './login';
import { AuthLogoutCommand } from './logout';
import { AuthRefreshCommand } from './refresh';
import { AuthRefreshTokenCommand } from './refresh-token';
import { AuthStatusCommand } from './status';
import { AuthSwitchCommand } from './switch';

export const AuthRoute = buildRouteMap({
  docs: {
    brief: `Authenticate with ${PRODUCT_NAME}`,
    fullDescription:
      'Sessions are stored as profiles, so several accounts and environments can be used side by side. Commands run against the active profile unless `--profile` names another one.'
  },
  routes: {
    login: AuthLoginCommand,
    logout: AuthLogoutCommand,
    status: AuthStatusCommand,
    switch: AuthSwitchCommand,
    list: AuthListCommand,
    refresh: AuthRefreshCommand,
    'access-token': AuthAccessTokenCommand,
    'refresh-token': AuthRefreshTokenCommand
  },
  aliases: {
    ls: 'list'
  }
});
