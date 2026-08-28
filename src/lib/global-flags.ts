import type { Command, RouteMap } from '@stricli/core';
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

const debugFlag = {
  kind: 'boolean',
  brief: 'Print where each resolved value came from',
  default: false
} as const;

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
}

/**
 * Reads `--debug` out of the raw arguments, because the context carries it and is
 * built before stricli parses the command's flags. Mirrors `getProfileFlag`.
 */
export function getDebugFlag(args: readonly string[]) {
  try {
    const { values } = parseArgs({
      args: [...args],
      options: { debug: { type: 'boolean' } },
      strict: false,
      allowPositionals: true
    });

    return values.debug === true;
  } catch {
    return false;
  }
}

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
