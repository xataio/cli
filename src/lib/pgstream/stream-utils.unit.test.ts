import { describe, expect, test } from 'bun:test';
import { Definition } from '@xata.io/pgstream';
import { exposedFlags, getCommandFlags, getGlobalFlags, toRuntimeFlags } from './stream-utils';

describe('getCommandFlags', () => {
  test('exposes only the listed pgstream flags besides the global ones', () => {
    const globals = Object.keys(getGlobalFlags());

    expect(Object.keys(getCommandFlags('snapshot')).sort()).toEqual([...globals, 'debug-profile', 'dump-file'].sort());
    expect(Object.keys(getCommandFlags('run')).sort()).toEqual([...globals, 'debug-profile', 'dump-file'].sort());
    expect(Object.keys(getCommandFlags('destroy')).sort()).toEqual(
      [...globals, 'migrations-only', 'replication-slot', 'slot-only', 'with-injector'].sort()
    );
  });

  test('keeps the flags the clone commands set through the environment out', () => {
    for (const command of ['snapshot', 'run'] as const) {
      for (const name of ['postgres-url', 'target-url', 'source-url', 'tables', 'snapshot-tables', 'reset', 'init']) {
        expect(getCommandFlags(command)).not.toHaveProperty(name);
      }
    }
  });
});

describe('toRuntimeFlags', () => {
  test('forwards --debug-profile under the name pgstream knows it by', () => {
    expect(toRuntimeFlags('snapshot', { 'debug-profile': true })).toEqual(['--profile=true']);
  });

  test('forwards the global flags and drops the ones it does not expose', () => {
    expect(toRuntimeFlags('run', { 'log-format': 'json', 'target-url': 'postgres://elsewhere', reset: true })).toEqual([
      '--log-format=json'
    ]);
  });
});

describe('exposedFlags', () => {
  test('only names flags pgstream defines for the command, so a renamed flag fails here first', () => {
    for (const [command, names] of Object.entries(exposedFlags)) {
      const own = Definition.commands.find((c) => c.name === command)?.flags.map((flag) => flag.name) ?? [];
      expect(Object.values(names).filter((name) => !own.includes(name))).toEqual([]);
    }
  });
});
