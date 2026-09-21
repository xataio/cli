import { Definition } from '@xata.io/pgroll';
import {
  type BinaryFlagDefinition,
  type BinaryFlagValues,
  type CliFlag,
  toBinaryArguments,
  toCliFlag
} from '~/lib/binary/flags';
import { contextFlags } from '~/lib/cli-utils';
import type { PgRollCommands, PgRollOptions, PgRollSubCommands } from '~/lib/pgroll/commands';

type CommandDefinition<CommandName extends PgRollCommands> = Extract<
  (typeof Definition.commands)[number],
  { name: CommandName }
>;

export type CommandFlags<CommandName extends PgRollCommands> = BinaryFlagValues<
  CommandDefinition<CommandName>['flags'][number]['name']
>;

export type SubcommandFlags<CommandName extends PgRollCommands, SubcommandName extends string> = BinaryFlagValues<
  Extract<CommandDefinition<CommandName>['subcommands'][number], { name: SubcommandName }>['flags'][number]['name']
>;

export type GlobalFlags = BinaryFlagValues<(typeof Definition.flags)[number]['name']>;

export function getCommandDefinition(command: PgRollCommands) {
  const commandDefinition = Definition.commands.find((c) => c.name === command);
  if (!commandDefinition) {
    throw new Error(`Command definition for ${command} not found`);
  }
  return commandDefinition;
}

export function getSubCommandDefinition<T extends PgRollCommands>(command: T, subCommand: PgRollSubCommands<T>) {
  const commandDefinition = getCommandDefinition(command);
  const subCommandDefinition = commandDefinition.subcommands.find((c) => c.name === subCommand);
  return subCommandDefinition;
}

/** The flags of a command, or of one of its subcommands, as pgroll defines them. */
function getOwnFlags(command: PgRollCommands, subcommand?: string): readonly BinaryFlagDefinition[] {
  const commandDefinition = getCommandDefinition(command);
  if (!subcommand) {
    return commandDefinition.flags;
  }
  return commandDefinition.subcommands.find((sub) => sub.name === subcommand)?.flags ?? [];
}

export function getCommandFlags(command: PgRollCommands, subcommand?: string): Record<string, CliFlag> {
  return {
    ...getGlobalFlags(),
    ...contextFlags,
    ...Object.fromEntries(getOwnFlags(command, subcommand).map((flag) => [flag.name, toCliFlag(flag)]))
  };
}

export function getGlobalFlags() {
  return Object.fromEntries(Definition.flags.map((flag) => [flag.name, toCliFlag(flag)]));
}

/** The pgroll arguments for every global and command flag that was passed. */
export function toRuntimeFlags<CommandType extends PgRollCommands>(
  command: CommandType,
  flags: Record<string, unknown>,
  subcommand?: string
) {
  const names = [...Definition.flags, ...getOwnFlags(command, subcommand)].map(
    (flag) => [flag.name, flag.name] as const
  );
  return toBinaryArguments(flags, new Map(names)) as NonNullable<PgRollOptions<CommandType>['flags']>;
}
