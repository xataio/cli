import { buildRouteMap } from '@stricli/core';
import { CLI_NAME } from '~/lib/constants';
import { AuthAccessTokenCommand } from './access-token';
import { AuthListCommand } from './list';
import { AuthLoginCommand } from './login';
import { AuthLogoutCommand } from './logout';
import { AuthRefreshTokenCommand } from './refresh-token';
import { AuthStatusCommand } from './status';
import { AuthSwitchCommand } from './switch';

export const AuthRoute = buildRouteMap({
  docs: {
    brief: `Authenticate with ${CLI_NAME}`
  },
  routes: {
    login: AuthLoginCommand,
    logout: AuthLogoutCommand,
    status: AuthStatusCommand,
    switch: AuthSwitchCommand,
    list: AuthListCommand,
    'access-token': AuthAccessTokenCommand,
    'refresh-token': AuthRefreshTokenCommand
  },
  aliases: {
    ls: 'list'
  }
});
