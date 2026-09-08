export function cycleNext<T extends string>(options: readonly [T, ...T[]], current: T): T {
  return options[options.indexOf(current) + 1] ?? options[0];
}

export function clampSelection(selected: number, rowCount: number): number {
  if (rowCount === 0) return 0;
  return Math.max(0, Math.min(selected, rowCount - 1));
}

export function listWindow(selected: number, rowCount: number, visibleCount: number): number {
  if (rowCount <= visibleCount) return 0;
  const top = selected - Math.floor(visibleCount / 2);
  return Math.max(0, Math.min(top, rowCount - visibleCount));
}
