export const CLI_NAME = 'xata';
export const PRODUCT_NAME = 'Xata';
export const DEFAULT_API_BASE_URL = 'https://api.xata.tech';
export const DEFAULT_API_ISSUER = 'https://auth.xata.io/realms/xata';
export const DEFAULT_API_CLIENT_ID = 'cli';
export const DEFAULT_API_CLIENT_SECRET = 'OhcooQuoNieghie4iege0zetoa3fah4j';
export const DEFAULT_DATABASE_NAME = 'xata';
export const DEFAULT_MIGRATIONS_DIRECTORY = `.${CLI_NAME}/migrations`;
export const DEFAULT_CLONE_RULES_FILE = `.${CLI_NAME}/clone.yaml`;
export const DEFAULT_CLONE_LOCAL_CONFIG_PATH = `.${CLI_NAME}/config.ts`;

/**
 * xata roll complete is used in /apps/webapp/scripts/build.sh that completes any pending migration
 * before merge to main. We want to ensure that any started migration is completed with the same version
 * (context https://github.com/xataio/frontend/pull/1351#pullrequestreview-3163817021).
 *
 * So, please complete any ongoing migrations before updating the pgroll version here. You can do so by running
 * the "Complete Migration" action via workflow_dispatch.
 */
export const PINNED_PGROLL_BINARY_VERSION = '0.16.1';
export const PINNED_PGSTREAM_BINARY_VERSION = '1.4.1';
