import { describe, expect, it } from 'bun:test';
import { buildBranchTuning, buildIndexConstraintSessionSettings } from './target-tuning';

function settingsMap(input: { ramGiB: number; milliVCPUs: number }) {
  return Object.fromEntries(buildIndexConstraintSessionSettings(input).map((s) => s.split('=')));
}

describe('buildBranchTuning', () => {
  it('carries only max_wal_size, the one cluster setting the populate guidance calls for', () => {
    const tuning = buildBranchTuning({ ramGiB: 32, milliVCPUs: 8000, storageGB: 500 });

    expect(Object.keys(tuning)).toEqual(['max_wal_size']);
  });

  it('sets max_wal_size to 15% of storage, capped at 100GB', () => {
    expect(buildBranchTuning({ ramGiB: 8, milliVCPUs: 2000, storageGB: 200 }).max_wal_size).toBe('30GB');
    expect(buildBranchTuning({ ramGiB: 8, milliVCPUs: 2000, storageGB: 5000 }).max_wal_size).toBe('100GB');
  });

  it('never lowers max_wal_size below the serving default of 4GB', () => {
    expect(buildBranchTuning({ ramGiB: 1, milliVCPUs: 500, storageGB: 10 }).max_wal_size).toBe('4GB');
  });

  it('falls back to the serving max_wal_size when storage is unknown', () => {
    expect(buildBranchTuning({ ramGiB: 8, milliVCPUs: 2000 }).max_wal_size).toBe('4GB');
  });

  it('leaves the serving default in place for everything else', () => {
    const tuning = buildBranchTuning({ ramGiB: 32, milliVCPUs: 8000, storageGB: 500 });

    for (const name of ['min_wal_size', 'checkpoint_timeout', 'max_worker_processes', 'shared_buffers']) {
      expect(tuning).not.toHaveProperty(name);
    }
  });

  it('never asks for more parallel workers than the serving max_worker_processes allows', () => {
    for (const milliVCPUs of [500, 2000, 8000, 16000, 32000]) {
      const requested = Number(settingsMap({ ramGiB: 32, milliVCPUs }).max_parallel_maintenance_workers);
      expect(requested).toBeLessThanOrEqual(32);
    }
  });
});

describe('buildIndexConstraintSessionSettings', () => {
  it('allocates a quarter of instance memory to maintenance_work_mem', () => {
    expect(settingsMap({ ramGiB: 2, milliVCPUs: 500 }).maintenance_work_mem).toBe('512MB');
    expect(settingsMap({ ramGiB: 16, milliVCPUs: 4000 }).maintenance_work_mem).toBe('4GB');
    expect(settingsMap({ ramGiB: 32, milliVCPUs: 8000 }).maintenance_work_mem).toBe('8GB');
    expect(settingsMap({ ramGiB: 64, milliVCPUs: 16000 }).maintenance_work_mem).toBe('16GB');
  });

  it('caps maintenance_work_mem at 16GB and floors it at 256MB', () => {
    expect(settingsMap({ ramGiB: 128, milliVCPUs: 32000 }).maintenance_work_mem).toBe('16GB');
    expect(settingsMap({ ramGiB: 512, milliVCPUs: 64000 }).maintenance_work_mem).toBe('16GB');
    expect(settingsMap({ ramGiB: 1, milliVCPUs: 500 }).maintenance_work_mem).toBe('256MB');
  });

  it('matches max_parallel_maintenance_workers to whole vCPUs', () => {
    expect(settingsMap({ ramGiB: 4, milliVCPUs: 500 }).max_parallel_maintenance_workers).toBe('2');
    expect(settingsMap({ ramGiB: 64, milliVCPUs: 16000 }).max_parallel_maintenance_workers).toBe('16');
  });

  it('raises maintenance_io_concurrency on instances with at least 8 vCPUs', () => {
    expect(settingsMap({ ramGiB: 16, milliVCPUs: 4000 }).maintenance_io_concurrency).toBe('32');
    expect(settingsMap({ ramGiB: 32, milliVCPUs: 8000 }).maintenance_io_concurrency).toBe('64');
  });

  it('emits whitespace-free name=value pairs, which is what pgstream accepts', () => {
    const pgstreamSessionSetting = /^[A-Za-z_][A-Za-z0-9_.]*=\S+$/;

    for (const ramGiB of [1, 8, 32, 128]) {
      for (const setting of buildIndexConstraintSessionSettings({ ramGiB, milliVCPUs: 8000 })) {
        expect(setting).toMatch(pgstreamSessionSetting);
      }
    }
  });

  it('never sets a cluster-scoped parameter, which a session cannot change', () => {
    const names = buildIndexConstraintSessionSettings({ ramGiB: 32, milliVCPUs: 8000 }).map((s) => s.split('=')[0]);

    expect(names).not.toContain('max_wal_size');
    expect(names).not.toContain('max_worker_processes');
    expect(names).not.toContain('autovacuum_max_workers');
  });
});
