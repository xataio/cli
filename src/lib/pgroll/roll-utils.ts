import { toBrief } from '~/lib/binary/utils';
import { Definition } from '@xata.io/pgroll';
import { contextFlags } from '~/lib/cli-utils';
import type { PgRollCommands, PgRollOptions, PgRollSubCommands } from '~/lib/pgroll/commands';

export type CommandFlags<CommandName extends PgRollCommands> = {
  [K in Extract<(typeof Definition.commands)[number], { name: CommandName }>['flags'][number]['name']]: boolean;
};

export type SubcommandFlags<CommandName extends PgRollCommands, SubcommandName extends string> = {
  [K in Extract<
    Extract<(typeof Definition.commands)[number], { name: CommandName }>['subcommands'][number],
    { name: SubcommandName }
  >['flags'][number]['name']]: string;
};

export function getCommandDefinition(command: PgRollCommands) {
  const commandDefinition = Definition.commands.find((c) => c.name === command);
  if (!commandDefinition) {
    throw new Error(`Command definition for ${command} not found`);
  }
  return commandDefinition;
}

export function getSubCommandDefinition<T extends PgRollCommands>(command: T, subCommand: PgRollSubCommands<T>) {
  const commandDefinition = Definition.commands.find((c) => c.name === command);
  if (!commandDefinition) {
    throw new Error(`Command definition for ${command} not found`);
  }
  const subCommandDefinition = commandDefinition.subcommands.find((c) => c.name === subCommand);
  return subCommandDefinition;
}

export type GlobalFlags = {
  [K in (typeof Definition.flags)[number]['name']]: string;
};

export function getCommandFlags<CommandType extends PgRollCommands>(command: PgRollCommands, subcommand?: string) {
  const globalFlags = getGlobalFlags();
  const commandDefinition = getCommandDefinition(command);

  const commandFlags = {
    ...globalFlags,
    ...contextFlags
  } as Record<
    keyof GlobalFlags | keyof CommandFlags<CommandType>,
    {
      kind: 'parsed';
      parse: StringConstructor;
      brief: string;
      optional: true;
    }
  >;

  // If subcommand is provided, use its flags, otherwise use command flags
  const flagsToProcess = subcommand
    ? commandDefinition.subcommands?.find((sub) => sub.name === subcommand)?.flags || []
    : commandDefinition.flags;

  for (const flag of flagsToProcess) {
    // @ts-expect-error
    commandFlags[flag.name] = {
      kind: 'parsed',
      parse: String,
      brief: toBrief(flag.description),
      /**
       * Note: we don't need to provide the default value here.
       * `pgroll` will automatically fall back to the default value
       *
       * If we provide a default value here, the `pgroll` binary will see it as
       * if the user provided that value and the precedence of flag over env will take place.
       *
       * i.e. the `roll` command won't support pgroll env vars.
       * Therefore, all pgroll flags are optional in the `roll` command
       */
      // default: flag.default
      optional: true
    };
  }

  return commandFlags;
}

export function getGlobalFlags() {
  const globalFlags = {} as Record<
    keyof GlobalFlags,
    {
      kind: 'parsed';
      parse: StringConstructor;
      brief: string;
      optional: true;
    }
  >;

  for (const flag of Definition.flags) {
    globalFlags[flag.name] = {
      kind: 'parsed',
      parse: String,
      brief: toBrief(flag.description),
      // Note: see comment in getCommandFlags regarding default values
      // default: flag.default
      optional: true
    };
  }
  return globalFlags;
}

export function convertGlobalFlagsToRuntimeFlags<CommandType extends PgRollCommands>(flags: GlobalFlags) {
  const runtimeFlags: NonNullable<PgRollOptions<CommandType>['flags']> = [];

  type FlagHandlers = { [K in keyof GlobalFlags]: (value: string) => void };

  const flagHandlers: FlagHandlers = {
    verbose: (value) => runtimeFlags.push(`--verbose=${value}`),
    'lock-timeout': (value) => runtimeFlags.push(`--lock-timeout=${value}`),
    'pgroll-schema': (value) => runtimeFlags.push(`--pgroll-schema=${value}`),
    'postgres-url': (value) => runtimeFlags.push(`--postgres-url=${value}`),
    role: (value) => runtimeFlags.push(`--role=${value}`),
    schema: (value) => runtimeFlags.push(`--schema=${value}`),
    'use-version-schema': (value) => runtimeFlags.push(`--use-version-schema=${value}`)
  };

  for (const [key, value] of Object.entries(flags)) {
    if (value && typeof value === 'string' && key in flagHandlers) {
      (flagHandlers as any)[key](value);
    }
  }

  return runtimeFlags;
}
