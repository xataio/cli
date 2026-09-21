import { describe, expect, test } from 'bun:test';
import { toBinaryArguments, toCliFlag } from './flags';

describe('toCliFlag', () => {
  test('turns a flag with a true or false default into a boolean', () => {
    for (const value of ['true', 'false']) {
      expect(toCliFlag({ name: 'json', description: 'output JSON', default: value })).toMatchObject({
        kind: 'boolean',
        optional: true,
        withNegated: false
      });
    }
  });

  test('keeps every other flag a string', () => {
    expect(toCliFlag({ name: 'lock-timeout', description: 'timeout', default: '500' })).toMatchObject({
      kind: 'parsed',
      optional: true
    });
    expect(toCliFlag({ name: 'dump-file', description: 'file', default: '' })).toMatchObject({ kind: 'parsed' });
  });

  test('never carries the default, so the binary still reads its environment variables', () => {
    expect(toCliFlag({ name: 'json', description: 'output JSON', default: 'false' })).not.toHaveProperty('default');
    expect(toCliFlag({ name: 'lock-timeout', description: 'timeout', default: '500' })).not.toHaveProperty('default');
  });
});

describe('toBinaryArguments', () => {
  const names = new Map([
    ['json', 'json'],
    ['debug-profile', 'profile'],
    ['lock-timeout', 'lock-timeout']
  ]);

  test('writes each passed flag as --name=value, false included', () => {
    expect(toBinaryArguments({ json: false, 'lock-timeout': '100' }, names)).toEqual([
      '--json=false',
      '--lock-timeout=100'
    ]);
    expect(toBinaryArguments({ json: true }, names)).toEqual(['--json=true']);
  });

  test('uses the name the binary knows the flag by', () => {
    expect(toBinaryArguments({ 'debug-profile': true }, names)).toEqual(['--profile=true']);
  });

  test('leaves out flags that were not passed, empty ones and ones it was not given', () => {
    expect(toBinaryArguments({ json: undefined, 'lock-timeout': '', organization: 'org' }, names)).toEqual([]);
  });
});
