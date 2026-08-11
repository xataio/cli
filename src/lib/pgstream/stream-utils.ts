import { toBrief } from '~/lib/binary/utils';
import { Definition } from '@xata.io/pgstream';
import type { PgStreamCommands, PgStreamOptions } from '~/lib/pgstream/commands';

export type CommandFlags<CommandName extends PgStreamCommands> = {
  [K in Extract<(typeof Definition.commands)[number], { name: CommandName }>['flags'][number]['name']]: boolean;
};

export function getCommandDefinition(command: PgStreamCommands) {
  const commandDefinition = Definition.commands.find((c) => c.name === command);
  if (!commandDefinition) {
    throw new Error(`Command definition for ${command} not found`);
  }
  return commandDefinition;
}

export type GlobalFlags = {
  [K in (typeof Definition.flags)[number]['name']]: string;
};

export function getCommandFlags<CommandType extends PgStreamCommands>(command: PgStreamCommands) {
  const globalFlags = getGlobalFlags();
  const commandDefinition = getCommandDefinition(command);

  const commandFlags = {
    ...globalFlags
  } as Record<
    keyof GlobalFlags | keyof CommandFlags<CommandType>,
    {
      kind: 'parsed';
      parse: StringConstructor;
      brief: string;
      optional: true;
    }
  >;

  for (const flag of commandDefinition.flags) {
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

export function convertGlobalFlagsToRuntimeFlags<CommandType extends PgStreamCommands>(flags: GlobalFlags) {
  const runtimeFlags: NonNullable<PgStreamOptions<CommandType>['flags']> = [];

  type FlagHandlers = { [K in keyof GlobalFlags]: (value: string) => void };

  const flagHandlers: FlagHandlers = {
    config: (value) => runtimeFlags.push(`--config=${value}`),
    'log-format': (value) => runtimeFlags.push(`--log-format=${value}`),
    'log-level': (value) => runtimeFlags.push(`--log-level=${value}`),
    'no-color': (value) => runtimeFlags.push(`--no-color=${value}`)
  };

  for (const [key, value] of Object.entries(flags)) {
    if (value && typeof value === 'string' && key in flagHandlers) {
      (flagHandlers as any)[key](value);
    }
  }

  return runtimeFlags;
}
