import { looseBooleanParser, type Command, type RouteMap } from '@stricli/core';
import { parseArgs } from 'node:util';
import type { LocalContext } from '~/context';

/** A route map holds commands or more route maps, a union stricli does not export. */
type RoutingTarget = Command<LocalContext> | RouteMap<LocalContext>;

const profileFlag = {
  kind: 'parsed',
  parse: String,
  brief: 'The profile to use',
  optional: true
} as const;

/** Left unset rather than defaulted, so `--flag=false` is distinguishable from an absent flag. */
const booleanFlag = (brief: string) =>
  ({
    kind: 'boolean',
    brief,
    optional: true,
    // stricli would otherwise generate a camelCase `--noFlag`, unlike every other flag name here.
    withNegated: false
  }) as const;

const debugFlag = booleanFlag('Print where each resolved value came from');
const jsonFlag = booleanFlag(
  'Output in JSON format when the command supports it. Defaults to on when an AI agent runs the command.'
);

function isRouteMap(target: RoutingTarget): target is RouteMap<LocalContext> {
  return 'getAllEntries' in target;
}

function addFlagsToCommand(command: Command<LocalContext>) {
  // stricli reads `parameters` both when it parses arguments and when it prints
  // help, so a command picks the flag up wherever it is used.
  const parameters = command.parameters as { flags?: Record<string, unknown> };
  parameters.flags ??= {};
  parameters.flags.profile ??= profileFlag;
  parameters.flags.debug ??= debugFlag;
  parameters.flags.json ??= jsonFlag;
}

/**
 * Reads a boolean flag out of the raw arguments, which is how the context gets the ones it
 * carries: it is built before stricli parses the command's own flags. `parseArgs` stops at `--`,
 * so an inner command keeps its own. Undefined means the flag was absent.
 */
function getBooleanFlag(args: readonly string[], name: string) {
  try {
    const { values } = parseArgs({
      args: [...args],
      options: { [name]: { type: 'boolean' } },
      strict: false,
      allowPositionals: true
    });

    const value = values[name];
    if (value === undefined) {
      return undefined;
    }
    // Non-strict parsing hands back true for a bare `--flag`, and the string for `--flag=<value>`.
    // That string goes through the parser stricli uses for the flag itself, so the two readings
    // cannot drift; a value it rejects throws, and stricli rejects the command for it anyway.
    return typeof value === 'boolean' ? value : looseBooleanParser(String(value));
  } catch {
    return undefined;
  }
}

export const getJsonFlag = (args: readonly string[]) => getBooleanFlag(args, 'json');

/** Unlike `--json` there is no agent default behind it, so an absent `--debug` is simply off. */
export const getDebugFlag = (args: readonly string[]) => getBooleanFlag(args, 'debug') ?? false;

/**
 * Adds the flags that every command accepts to a route map, in one place, so no
 * command has to declare them and a new command cannot be added without them.
 */
export function addGlobalFlags<TARGET extends RoutingTarget>(target: TARGET): TARGET {
  if (!isRouteMap(target)) {
    addFlagsToCommand(target);
    return target;
  }

  for (const entry of target.getAllEntries()) {
    addGlobalFlags(entry.target as RoutingTarget);
  }

  return target;
}
