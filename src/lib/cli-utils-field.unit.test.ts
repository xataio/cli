import { describe, expect, mock, test } from 'bun:test';
import stripAnsi from 'strip-ansi';
import type { LocalContext } from '~/context';
import { printField } from './cli-utils';

const fields = ['name', 'description', 'publicAccess', 'configuration'];
const record = { name: 'main', publicAccess: false, configuration: { replicas: 1 } };

function buildContext() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const context = {
    process: {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: (value: string) => stderr.push(value) },
      exit: mock((code?: number) => {
        throw new Error(`exit:${code}`);
      })
    }
  } as unknown as LocalContext;
  return { context, stdout, stderr };
}

describe('printField', () => {
  test.each([
    ['name', 'main\n'],
    ['description', '\n'],
    ['publicAccess', 'false\n'],
    ['configuration', '{\n  "replicas": 1\n}\n']
  ])('prints %s', (field, expected) => {
    const { context, stdout, stderr } = buildContext();
    printField(context, 'branch', fields, record, field);
    expect(stdout.join('')).toBe(expected);
    expect(stderr).toEqual([]);
  });

  test('lists every field in the catalog, including ones the record omits', () => {
    const { context, stdout } = buildContext();
    printField(context, 'branch', fields, record, '.catalog');
    expect(stripAnsi(stdout.join(''))).toEndWith('- name\n- description\n- publicAccess\n- configuration\n');
  });

  test('rejects an unknown field', () => {
    const { context, stdout, stderr } = buildContext();
    expect(() => printField(context, 'branch', fields, record, 'nope')).toThrow('exit:1');
    expect(stripAnsi(stderr.join(''))).toBe('Invalid field: nope\n');
    expect(stdout).toEqual([]);
  });
});
