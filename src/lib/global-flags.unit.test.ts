import { describe, expect, test } from 'bun:test';
import { app } from '~/app';
import { getDebugFlag, getJsonFlag, profileFlag } from './global-flags';

type Entry = {
  name: Record<string, string>;
  target: { parameters?: { flags?: Record<string, unknown> }; getAllEntries?: () => readonly Entry[] };
  hidden?: boolean;
};

function collectCommands(
  target: Entry['target'],
  route: string[]
): { route: string; flags: Record<string, unknown> }[] {
  const entries = target.getAllEntries?.() ?? [];

  return entries
    .filter((entry) => {
      return !entry.hidden;
    })
    .flatMap((entry) => {
      const name = entry.name['convert-camel-to-kebab'] ?? entry.name.original ?? '';
      const childRoute = [...route, name];

      if (entry.target.getAllEntries) {
        return collectCommands(entry.target, childRoute);
      }

      return [{ route: childRoute.join(' '), flags: entry.target.parameters?.flags ?? {} }];
    });
}

describe('global flags', () => {
  test('every command accepts --profile', () => {
    const commands = collectCommands((app as unknown as { root: Entry['target'] }).root, ['xata']);
    const missing = commands.filter(({ flags }) => {
      return !('profile' in flags);
    });

    expect(commands.length).toBeGreaterThan(0);
    expect(missing.map(({ route }) => route)).toEqual([]);
  });

  test('every command accepts --json', () => {
    const commands = collectCommands((app as unknown as { root: Entry['target'] }).root, ['xata']);
    const missing = commands.filter(({ flags }) => {
      return !('json' in flags);
    });

    expect(commands.length).toBeGreaterThan(0);
    expect(missing.map(({ route }) => route)).toEqual([]);
  });

  test('every command accepts --debug', () => {
    const commands = collectCommands((app as unknown as { root: Entry['target'] }).root, ['xata']);
    const missing = commands.filter(({ flags }) => {
      return !('debug' in flags);
    });

    expect(commands.length).toBeGreaterThan(0);
    expect(missing.map(({ route }) => route)).toEqual([]);
  });
});

describe('--json', () => {
  const commands = () => collectCommands((app as unknown as { root: Entry['target'] }).root, []);

  const jsonFlags = () => {
    return commands()
      .map(({ route, flags }) => ({ route, json: flags.json }))
      .filter((command): command is { route: string; json: Record<string, unknown> } => Boolean(command.json));
  };

  test('has no default, so that the agent default is not shadowed', () => {
    const withDefault = jsonFlags().filter(({ json }) => 'default' in json);

    expect(jsonFlags().length).toBeGreaterThan(0);
    expect(withDefault.map(({ route }) => route)).toEqual([]);
  });

  test('is optional, so that --json=false can be told apart from an unset flag', () => {
    const notOptional = jsonFlags().filter(({ json }) => json.optional !== true);

    expect(notOptional.map(({ route }) => route)).toEqual([]);
  });

  test('reads the flag from anywhere in the arguments', () => {
    expect(getJsonFlag(['branch', 'list', '--json'])).toBe(true);
    expect(getJsonFlag(['--json', 'branch', 'list'])).toBe(true);
  });

  test('tells --json=false apart from an absent flag', () => {
    expect(getJsonFlag(['branch', 'list', '--json=false'])).toBe(false);
    expect(getJsonFlag(['branch', 'list', '--json=true'])).toBe(true);
  });

  test('reads every falsy spelling stricli accepts, whatever its case', () => {
    for (const value of ['false', 'False', 'FALSE', 'f', 'no', 'n', 'off', '0']) {
      expect(getJsonFlag(['branch', 'list', `--json=${value}`])).toBe(false);
    }
  });

  test('reads the truthy spellings stricli accepts', () => {
    for (const value of ['true', 'True', 'TRUE', 't', 'yes', 'y', 'on', '1']) {
      expect(getJsonFlag(['branch', 'list', `--json=${value}`])).toBe(true);
    }
  });

  test('stops at --, so an inner command keeps its own flags', () => {
    expect(getJsonFlag(['scratch', '--', 'psql', '--json'])).toBeUndefined();
  });

  test('reads the same spellings stricli does, and leaves the ones it rejects unset', () => {
    expect(getJsonFlag(['branch', 'list', '--json=yes'])).toBe(true);
    expect(getJsonFlag(['branch', 'list', '--json=0'])).toBe(false);
    // stricli fails the command for this, so the context value never gets used.
    expect(getJsonFlag(['branch', 'list', '--json=maybe'])).toBeUndefined();
  });
});

describe('getDebugFlag', () => {
  test('reads the flag from anywhere in the arguments', () => {
    expect(getDebugFlag(['branch', 'list', '--debug'])).toBe(true);
    expect(getDebugFlag(['--debug', 'branch', 'list'])).toBe(true);
  });

  test('is false when the flag is absent', () => {
    expect(getDebugFlag(['branch', 'list'])).toBe(false);
  });

  // `--debug=true` used to read as false: the old reader compared against `true` and a value
  // arrives as a string, so every `--debug=<value>` turned debug off.
  test('reads a value the same way --json does', () => {
    expect(getDebugFlag(['branch', 'list', '--debug=true'])).toBe(true);
    expect(getDebugFlag(['branch', 'list', '--debug=false'])).toBe(false);
    expect(getDebugFlag(['branch', 'list', '--debug=off'])).toBe(false);
  });

  test('stops at --, so an inner command keeps its own flags', () => {
    expect(getDebugFlag(['scratch', '--', 'psql', '--debug'])).toBe(false);
  });
});

describe('--profile', () => {
  // The auth commands once declared their own `profile` flag, some with `default: 'default'`, which
  // shadowed this one and made them act on a profile named `default` instead of the active one.
  // `clone start` and `clone stream` forward pgstream's own `--profile`, which turns on CPU and
  // memory profiling rather than naming a Xata profile.
  test('is the global flag on every command but the ones pgstream defines it for', () => {
    const commands = collectCommands((app as unknown as { root: Entry['target'] }).root, ['xata']);
    const redeclared = commands.filter(({ flags }) => {
      return flags.profile !== profileFlag;
    });

    expect(redeclared.map(({ route }) => route)).toEqual(['xata clone start', 'xata clone stream']);
  });
});
