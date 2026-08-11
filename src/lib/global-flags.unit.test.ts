import { describe, expect, test } from 'bun:test';
import { app } from '~/app';

type Entry = {
  name: Record<string, string>;
  target: { parameters?: { flags?: Record<string, unknown> }; getAllEntries?: () => readonly Entry[] };
  hidden?: boolean;
};

function collectCommands(target: Entry['target'], route: string[]): { route: string; flags: string[] }[] {
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

      return [{ route: childRoute.join(' '), flags: Object.keys(entry.target.parameters?.flags ?? {}) }];
    });
}

describe('global flags', () => {
  test('every command accepts --profile', () => {
    const commands = collectCommands((app as unknown as { root: Entry['target'] }).root, ['xata']);
    const missing = commands.filter(({ flags }) => {
      return !flags.includes('profile');
    });

    expect(commands.length).toBeGreaterThan(0);
    expect(missing.map(({ route }) => route)).toEqual([]);
  });
});
