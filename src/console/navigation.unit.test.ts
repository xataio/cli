import { describe, expect, test } from 'bun:test';
import { clampSelection, cycleNext, listWindow } from './navigation';

const options = ['a', 'b', 'c'] as const;

describe('console navigation helpers', () => {
  test('cycleNext advances, wraps, and falls back to the first option', () => {
    expect(cycleNext(options, 'a')).toBe('b');
    expect(cycleNext(options, 'c')).toBe('a');
    expect(cycleNext(options, 'zzz' as (typeof options)[number])).toBe('a');
  });

  test('clampSelection keeps selection within row bounds', () => {
    expect(clampSelection(5, 3)).toBe(2);
    expect(clampSelection(-1, 3)).toBe(0);
    expect(clampSelection(1, 0)).toBe(0);
  });

  test('listWindow keeps the selection visible', () => {
    expect(listWindow(0, 10, 5)).toBe(0);
    expect(listWindow(9, 10, 5)).toBe(5);
    expect(listWindow(5, 10, 5)).toBe(3);
    expect(listWindow(2, 4, 10)).toBe(0);
  });
});
