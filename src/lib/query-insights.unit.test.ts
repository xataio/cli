import { describe, expect, test } from 'bun:test';
import { resolvePgStatStatementsReadiness } from './query-insights';

describe('query insights lib', () => {
  test('resolvePgStatStatementsReadiness maps status to readiness', () => {
    expect(resolvePgStatStatementsReadiness(undefined)).toEqual({ state: 'unavailable' });
    expect(
      resolvePgStatStatementsReadiness({
        available: false,
        installed: false,
        preloaded: false,
        sharedPreloadLibraries: ''
      })
    ).toEqual({ state: 'unavailable' });
    expect(
      resolvePgStatStatementsReadiness({
        available: true,
        installed: false,
        preloaded: true,
        sharedPreloadLibraries: 'pg_stat_statements'
      })
    ).toEqual({ state: 'disabled' });
    expect(
      resolvePgStatStatementsReadiness({
        available: true,
        installed: true,
        preloaded: false,
        sharedPreloadLibraries: ''
      })
    ).toEqual({ state: 'disabled' });
    expect(
      resolvePgStatStatementsReadiness({
        available: true,
        installed: true,
        preloaded: true,
        sharedPreloadLibraries: 'pg_stat_statements'
      })
    ).toEqual({ state: 'ready' });
  });
});
