import { Definition } from '@xata.io/pgstream';
import {
  type BinaryFlagDefinition,
  type BinaryFlagValues,
  type CliFlag,
  toBinaryArguments,
  toCliFlag
} from '~/lib/binary/flags';
import type { PgStreamCommands, PgStreamOptions } from '~/lib/pgstream/commands';

/**
 * CLI name to pgstream name. The clone commands set connections and tables through the environment,
 * so those flags stay out, and `profile` is renamed so it does not shadow the Xata profile flag.
 */
export const exposedFlags = {
  snapshot: { 'debug-profile': 'profile', 'dump-file': 'dump-file' },
  run: { 'debug-profile': 'profile', 'dump-file': 'dump-file' },
  destroy: {
    'migrations-only': 'migrations-only',
    'replication-slot': 'replication-slot',
    'slot-only': 'slot-only',
    'with-injector': 'with-injector'
  }
} as const satisfies Partial<Record<PgStreamCommands, Readonly<Record<string, string>>>>;

type ExposedCommand = keyof typeof exposedFlags;

export type CommandFlags<CommandName extends PgStreamCommands> = BinaryFlagValues<
  CommandName extends ExposedCommand ? keyof (typeof exposedFlags)[CommandName] & string : never
>;

export type GlobalFlags = BinaryFlagValues<(typeof Definition.flags)[number]['name']>;

export function getCommandDefinition(command: PgStreamCommands) {
  const commandDefinition = Definition.commands.find((c) => c.name === command);
  if (!commandDefinition) {
    throw new Error(`Command definition for ${command} not found`);
  }
  return commandDefinition;
}

/** The exposed flags of a command, each with the definition pgstream gives it. */
function getExposedFlags(command: PgStreamCommands) {
  const names: Readonly<Record<string, string>> = exposedFlags[command as ExposedCommand] ?? {};
  const ownFlags: readonly BinaryFlagDefinition[] = getCommandDefinition(command).flags;

  return Object.entries(names).flatMap(([cliName, binaryName]) => {
    const flag = ownFlags.find((own) => own.name === binaryName);
    return flag ? [{ cliName, binaryName, flag }] : [];
  });
}

export function getCommandFlags(command: PgStreamCommands): Record<string, CliFlag> {
  return {
    ...getGlobalFlags(),
    ...Object.fromEntries(getExposedFlags(command).map(({ cliName, flag }) => [cliName, toCliFlag(flag)]))
  };
}

export function getGlobalFlags() {
  return Object.fromEntries(Definition.flags.map((flag) => [flag.name, toCliFlag(flag)]));
}

/** The pgstream arguments for every global and exposed flag that was passed. */
export function toRuntimeFlags<CommandType extends PgStreamCommands>(
  command: CommandType,
  flags: Record<string, unknown>
) {
  const names = [
    ...Definition.flags.map((flag) => [flag.name, flag.name] as const),
    ...getExposedFlags(command).map(({ cliName, binaryName }) => [cliName, binaryName] as const)
  ];
  return toBinaryArguments(flags, new Map(names)) as NonNullable<PgStreamOptions<CommandType>['flags']>;
}
