import { buildApplication, buildRouteMap, text_en } from '@stricli/core';
import { SessionExpiredError } from '@xata.io/api';
import { AuthRoute } from './commands/auth';
import { BranchRoute } from './commands/branch';
import { BranchCheckoutCommand } from './commands/branch/checkout';
import { CloneRoute } from './commands/clone';
import { CompletionsRoute } from './commands/completions';
import { KeysRoute } from './commands/keys';
import { OrganizationRoute } from './commands/organization';
import { ProjectRoute } from './commands/project';
import { ProjectInitCommand } from './commands/project/init';
import { RollRoute } from './commands/roll';
import { StatusCommand } from './commands/status';
import { StreamRoute } from './commands/stream';
import { UpgradeCommand } from './commands/upgrade';
import { VersionCommand } from './commands/version';
import { OnboardCommand } from './commands/onboard';
import { ScratchCommand } from './commands/scratch';
import { CLI_NAME } from './lib/constants';
import { addGlobalFlags } from './lib/global-flags';
import { getCLIVersion, getLatestVersion } from './lib/updates';
import { AiRoute } from './commands/ai';

const routes = buildRouteMap({
  routes: {
    ai: AiRoute,
    init: ProjectInitCommand,
    onboard: OnboardCommand,
    auth: AuthRoute,
    organization: OrganizationRoute,
    project: ProjectRoute,
    branch: BranchRoute,
    keys: KeysRoute,

    roll: RollRoute,
    clone: CloneRoute,
    stream: StreamRoute,

    status: StatusCommand,
    version: VersionCommand,
    checkout: BranchCheckoutCommand,
    scratch: ScratchCommand,

    upgrade: UpgradeCommand,

    completions: CompletionsRoute
  },
  aliases: {
    org: 'organization'
  },
  docs: {
    brief: `${CLI_NAME} CLI`,
    hideRoute: {
      onboard: true,
      ai: true,
      stream: true
    }
  }
});

export const app = buildApplication(addGlobalFlags(routes), {
  name: CLI_NAME,
  scanner: {
    allowArgumentEscapeSequence: true
  },
  versionInfo: {
    currentVersion: getCLIVersion(),
    getLatestVersion,
    upgradeCommand: `${CLI_NAME} upgrade`
  },
  localization: {
    loadText: () => {
      return {
        ...text_en,
        exceptionWhileRunningCommand: (e) => {
          // Expired offline session that was not recovered.
          if (e instanceof SessionExpiredError) {
            return `Error: Your Xata session has expired. Please use \`${CLI_NAME} auth login\` to log in again.`;
          }
          // @ts-expect-error error object is not typed
          const errorId = e.stack?.id ? ` (id: ${e.stack.id})` : '';
          // @ts-expect-error error object is not typed
          const errorString = `${e.message}${errorId}`;
          // Note: in api.ts, we return a dummy client if the user is not logged in
          // that helps us use APIs like refresh token but fails with this error for other commands
          // This makes the error message more user friendly
          if (errorString.includes(`fetch() URL is invalid`)) {
            return `Error: You are loggged out. Please use \`${CLI_NAME} auth login\` to login.`;
          }
          return `Error: ${errorString}`;
        }
      };
    }
  },
  documentation: {
    // Note: this makes the wrapped documentation of pgroll more useful
    // https://github.com/bloomberg/stricli/issues/50
    onlyRequiredInUsageLine: true
  }
});
