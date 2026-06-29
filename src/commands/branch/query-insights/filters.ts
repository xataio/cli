import type { PerformanceCategory, QueryType } from './types';
import { PERFORMANCE_CATEGORIES, QUERY_TYPES } from './types';

export function parseCommaSeparatedValues<T extends string>(
  value: string | undefined,
  allowedValues: readonly T[],
  label: string,
  normalize: (value: string) => string = (part) => part.toUpperCase()
): T[] {
  if (!value) return [];
  const values = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(normalize) as T[];
  const invalid = values.filter((part) => !allowedValues.includes(part));
  if (invalid.length > 0) {
    throw new Error(`Invalid ${label}: ${invalid.join(', ')}. Valid values are: ${allowedValues.join(', ')}`);
  }
  return values;
}

export function parseStringFilter(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseQueryTypes(value: string | undefined): QueryType[] {
  return parseCommaSeparatedValues(value, QUERY_TYPES, 'query type');
}

export function parsePerformanceCategories(value: string | undefined): PerformanceCategory[] {
  return parseCommaSeparatedValues(value, PERFORMANCE_CATEGORIES, 'performance category', (category) =>
    category.toLowerCase()
  );
}
