import { toBrief } from './utils';

/** A flag as the generated pgroll and pgstream definitions describe it. */
export type BinaryFlagDefinition = {
  readonly name: string;
  readonly description: string;
  readonly default?: string;
};

/** The values stricli hands back for the flags built by `toCliFlag`, unset when not passed. */
export type BinaryFlagValues<Name extends string> = { [K in Name]?: string | boolean };

function isBooleanFlag(flag: BinaryFlagDefinition) {
  return flag.default === 'true' || flag.default === 'false';
}

/** No default: the binary applies its own, and one passed here would override the user's env vars. */
export function toCliFlag(flag: BinaryFlagDefinition) {
  if (isBooleanFlag(flag)) {
    return {
      kind: 'boolean',
      brief: toBrief(flag.description),
      optional: true,
      // stricli would otherwise generate a camelCase `--noFlag`, unlike the binary's own flags.
      withNegated: false
    } as const;
  }

  return { kind: 'parsed', parse: String, brief: toBrief(flag.description), optional: true } as const;
}

export type CliFlag = ReturnType<typeof toCliFlag>;

/** Writes each passed flag as `--binaryName=value`, so `--json=false` stays off. */
export function toBinaryArguments(flags: Record<string, unknown>, names: ReadonlyMap<string, string>) {
  const args: `--${string}`[] = [];

  for (const [cliName, binaryName] of names) {
    const value = flags[cliName];
    if (value === undefined || value === '') {
      continue;
    }
    args.push(`--${binaryName}=${String(value)}`);
  }

  return args;
}
