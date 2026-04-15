import { CLI_NAME } from '~/lib/constants';

const targets = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'windows-x64'];

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
    `bun-${target}`
  ]);

  if (proc.exitCode !== 0) {
    throw Error(`Failed to build for ${target}`);
  }

  console.log(`Built for ${target}`);
}
