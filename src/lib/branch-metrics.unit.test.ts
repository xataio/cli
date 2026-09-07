import { describe, expect, test } from 'bun:test';
import { resolveMetricInstances } from './branch-metrics';

const instances = [
  { id: 'inst-1', primary: true },
  { id: 'inst-2', primary: false },
  { id: 'inst-3', primary: false }
];

describe('resolveMetricInstances', () => {
  test('returns all instances for the all selector', () => {
    expect(resolveMetricInstances(instances, 'all')).toEqual(instances);
  });

  test('filters primary and replicas', () => {
    expect(resolveMetricInstances(instances, 'primary')).toEqual([{ id: 'inst-1', primary: true }]);
    expect(resolveMetricInstances(instances, 'replicas')).toEqual([
      { id: 'inst-2', primary: false },
      { id: 'inst-3', primary: false }
    ]);
  });

  test('selects instances by comma-separated ids', () => {
    expect(resolveMetricInstances(instances, 'inst-3, inst-1')).toEqual([
      { id: 'inst-1', primary: true },
      { id: 'inst-3', primary: false }
    ]);
  });

  test('throws on unknown instance ids', () => {
    expect(() => resolveMetricInstances(instances, 'inst-1,nope')).toThrow('Invalid instance: nope');
    expect(() => resolveMetricInstances(instances, 'nope,also-nope')).toThrow('Invalid instances: nope, also-nope');
  });
});
