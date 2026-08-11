import type { Command, RouteMap } from '@stricli/core';
import type { LocalContext } from '~/context';

/** A route map holds commands or more route maps, a union stricli does not export. */
type RoutingTarget = Command<LocalContext> | RouteMap<LocalContext>;

const profileFlag = {
  kind: 'parsed',
  parse: String,
  brief: 'The profile to use',
  optional: true
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
