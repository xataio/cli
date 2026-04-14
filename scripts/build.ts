import invariant from 'tiny-invariant';
import { CLI_NAME } from '~/lib/constants';

const targets = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'windows-x64'];

invariant(Bun.env.PUBLIC_AUTH_CLIENT_SECRET_DEV, 'PUBLIC_AUTH_CLIENT_SECRET_DEV is not set');
invariant(Bun.env.PUBLIC_AUTH_CLIENT_SECRET_STAGING, 'PUBLIC_AUTH_CLIENT_SECRET_STAGING is not set');
invariant(Bun.env.PUBLIC_AUTH_CLIENT_SECRET_PROD, 'PUBLIC_AUTH_CLIENT_SECRET_PROD is not set');

for (const target of targets) {
  const proc = Bun.spawnSync([
    'bun',
    'build',
    '--compile',
    '--minify',
    '--sourcemap',
    './src/bin/cli.ts',
    '--outfile',
    `./dist/${CLI_NAME}-${target}`,
    '--target',
    `bun-${target}`,
    '--env',
    `PUBLIC_*`
  ]);

  if (proc.exitCode !== 0) {
    throw Error(`Failed to build for ${target}`);
  }

  console.log(`Built for ${target}`);
}
