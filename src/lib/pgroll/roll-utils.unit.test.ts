import { describe, expect, test } from 'bun:test';
import { Definition } from '@xata.io/pgroll';
import { getCommandFlags, toRuntimeFlags } from './roll-utils';

describe('getCommandFlags', () => {
  test('turns pgroll switches into booleans, so --json needs no value', () => {
    expect(getCommandFlags('pull').json).toMatchObject({ kind: 'boolean' });
    expect(getCommandFlags('start')['skip-validation']).toMatchObject({ kind: 'boolean' });
    expect(getCommandFlags('start').verbose).toMatchObject({ kind: 'boolean' });
  });

  test('exposes every flag pgroll defines for the command', () => {
    for (const flag of Definition.commands.find((command) => command.name === 'baseline')?.flags ?? []) {
      expect(getCommandFlags('baseline')).toHaveProperty(flag.name);
    }
  });
});

describe('toRuntimeFlags', () => {
  test('forwards the command flags that were passed, false included', () => {
    expect(toRuntimeFlags('start', { complete: true, 'skip-validation': false })).toEqual([
      '--complete=true',
      '--skip-validation=false'
    ]);
    expect(toRuntimeFlags('baseline', { json: true, yes: true })).toEqual(['--json=true', '--yes=true']);
  });

  test('forwards the global flags alongside them', () => {
    expect(toRuntimeFlags('pull', { 'lock-timeout': '100', json: true })).toEqual([
      '--lock-timeout=100',
      '--json=true'
    ]);
  });

  test("reads a subcommand's flags", () => {
    expect(toRuntimeFlags('latest', { local: './migrations' }, 'migration')).toEqual(['--local=./migrations']);
  });

  test('keeps the flags the CLI reads itself away from pgroll', () => {
    expect(toRuntimeFlags('pull', { organization: 'org', project: 'prj', branch: 'main', json: undefined })).toEqual(
      []
    );
  });
});

describe('pgroll flag names', () => {
  // `json` means the same thing to pgroll as it does to the CLI, so it is allowed to share the name.
  test('never take a name the CLI uses for a flag of its own', () => {
    const names = Definition.commands.flatMap((command) => [
      ...command.flags.map((flag) => flag.name),
      ...command.subcommands.flatMap((sub) => sub.flags.map((flag) => flag.name))
    ]);
    const clashing = [...Definition.flags.map((flag) => flag.name), ...names].filter((name) =>
      ['profile', 'debug', 'organization', 'project', 'branch', 'database'].includes(name)
    );

    expect(clashing).toEqual([]);
  });
});
