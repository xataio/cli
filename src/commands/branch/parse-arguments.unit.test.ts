import { describe, expect, test } from 'bun:test';
import { parseArguments } from './get';

describe('parseArguments function tests', () => {
  test('single argument - field only', () => {
    const result = parseArguments(['name']);
    expect(result.branchName).toBeUndefined();
    expect(result.field).toBe('name');
  });

  test('two arguments - branchName and field', () => {
    const result = parseArguments(['my-branch', 'id']);
    expect(result.branchName).toBe('my-branch');
    expect(result.field).toBe('id');
  });

  test('no arguments - defaults to .catalog', () => {
    const result = parseArguments([]);
    expect(result.branchName).toBeUndefined();
    expect(result.field).toBe('.catalog');
  });

  test('three or more arguments - throws error', () => {
    expect(() => parseArguments(['arg1', 'arg2', 'arg3'])).toThrow(
      'Too many arguments. Usage: xata branch get [branch] field'
    );
  });
});
