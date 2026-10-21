import { describe, expect, mock, test } from 'bun:test';
import stripAnsi from 'strip-ansi';
import type { LocalContext } from '~/context';
import { printDetails } from '~/lib/cli-utils';
import { implementation as configure } from './configure';
import { implementation as describeBackup } from './describe';
import { implementation as status } from './status';

type Branch = {
  backupsEnabled: boolean;
  backupConfiguration?: { retentionPeriod?: number; backupTime?: string };
};

function buildContext(branch: Branch, outputJson = true) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const describeBranch = mock(async () => branch);
  const updateBranch = mock(async (_args: unknown) => ({}));
  const getBackup = mock(async () => ({
    id: 'br_1',
    branchID: 'br_1',
    description: 'Point in time recovery',
    earliestRestore: '2026-10-13T04:00:00.000Z',
    latestRestore: '2026-10-20T10:15:30.000Z'
  }));
  const getBranch = mock(async (..._args: unknown[]) => 'br_1');
  const context = {
    outputJson,
    process: {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: (value: string) => stderr.push(value) },
      exit: mock((code?: number) => {
        throw new Error(`exit:${code}`);
      })
    },
    api: { branches: { describeBranch, updateBranch }, projects: { getBackup } },
    getOrganization: async () => 'org_1',
    getProject: async () => 'proj_1',
    getBranch,
    printDetails
  } as unknown as LocalContext;
  return { context, stdout, stderr, updateBranch, describeBranch, getBranch };
}

describe('backup status', () => {
  test('prints the json shape', async () => {
    const { context, stdout } = buildContext({
      backupsEnabled: true,
      backupConfiguration: { retentionPeriod: 14, backupTime: '1:04:00' }
    });
    await status.call(context, {});
    expect(JSON.parse(stdout.join(''))).toEqual({
      backupId: 'br_1',
      branchId: 'br_1',
      earliestRestore: '2026-10-13T04:00:00.000Z',
      latestRestore: '2026-10-20T10:15:30.000Z',
      retentionDays: 14,
      schedule: { cadence: 'weekly', dayOfWeek: 'monday', time: '04:00' }
    });
  });

  test('prints UTC times and a Xata-chosen schedule', async () => {
    const { context, stdout } = buildContext(
      { backupsEnabled: true, backupConfiguration: { retentionPeriod: 7 } },
      false
    );
    await status.call(context, {});
    const output = stripAnsi(stdout.join(''));
    expect(output).toContain('2026-10-13 04:00:00 UTC');
    expect(output).toContain('2026-10-20 10:15:30 UTC');
    expect(output).toContain('weekly on Sunday, time chosen by Xata');
  });
});

describe('backup describe', () => {
  test('prints the same field names as status', async () => {
    const { context, stdout } = buildContext({ backupsEnabled: true });
    await describeBackup.call(context, {});
    expect(JSON.parse(stdout.join(''))).toEqual({
      backupId: 'br_1',
      branchId: 'br_1',
      earliestRestore: '2026-10-13T04:00:00.000Z',
      latestRestore: '2026-10-20T10:15:30.000Z',
      description: 'Point in time recovery'
    });
  });

  test('labels the branch like status', async () => {
    const { context, stdout } = buildContext({ backupsEnabled: true }, false);
    await describeBackup.call(context, {});
    expect(stripAnsi(stdout.join(''))).toContain('branch');
    expect(stripAnsi(stdout.join(''))).not.toContain('branch_id');
  });
});

describe('branch positional', () => {
  const branch = { backupsEnabled: true, backupConfiguration: { retentionPeriod: 7 } };

  test('status passes it to getBranch', async () => {
    const { context, getBranch } = buildContext(branch);
    await status.call(context, {}, 'main');
    expect(getBranch.mock.calls[0]?.[2]).toMatchObject({ branchName: 'main' });
  });

  test('describe passes it to getBranch', async () => {
    const { context, getBranch } = buildContext(branch);
    await describeBackup.call(context, {}, 'main');
    expect(getBranch.mock.calls[0]?.[2]).toMatchObject({ branchName: 'main' });
  });

  test('describe rejects it together with --backup', async () => {
    const { context, getBranch } = buildContext(branch);
    await expect(describeBackup.call(context, { backup: 'br_1' }, 'main')).rejects.toThrow('exit:1');
    expect(getBranch).not.toHaveBeenCalled();
  });
});

describe('backup configure', () => {
  const branch: Branch = { backupsEnabled: true, backupConfiguration: { retentionPeriod: 7, backupTime: '1:04:00' } };

  test('rejects invalid flags before any API call', async () => {
    const { context, stderr, describeBranch, updateBranch } = buildContext(branch);
    await expect(configure.call(context, { retention: '36' })).rejects.toThrow('exit:1');
    expect(stderr.join('')).toStartWith('Error: ');
    expect(describeBranch).not.toHaveBeenCalled();
    expect(updateBranch).not.toHaveBeenCalled();
  });

  test('rejects a day of week on a daily branch without updating', async () => {
    const { context, stderr, updateBranch } = buildContext({
      backupsEnabled: true,
      backupConfiguration: { retentionPeriod: 7, backupTime: '*:04:00' }
    });
    await expect(configure.call(context, { 'day-of-week': 'monday' })).rejects.toThrow('exit:1');
    expect(stderr.join('')).toContain('--day-of-week');
    expect(updateBranch).not.toHaveBeenCalled();
  });

  test('accepts a mixed case day and keeps the current one when omitted', async () => {
    const { context, updateBranch } = buildContext(branch);
    await configure.call(context, { 'day-of-week': 'FRIDAY', retention: '10' });
    expect(updateBranch.mock.calls[0]?.[0]).toMatchObject({
      body: { backupConfiguration: { backupTime: '5:04:00', retentionPeriod: 10 } }
    });
    await configure.call(context, { time: '06:30' });
    expect(updateBranch.mock.calls[1]?.[0]).toMatchObject({
      body: { backupConfiguration: { backupTime: '1:06:30', retentionPeriod: 7 } }
    });
  });

  test('updates retention on a branch without a backup time', async () => {
    const { context, updateBranch } = buildContext({
      backupsEnabled: true,
      backupConfiguration: { retentionPeriod: 7 }
    });
    await configure.call(context, { retention: '21' });
    expect(updateBranch.mock.calls[0]?.[0]).toMatchObject({
      body: { backupConfiguration: { retentionPeriod: 21 } }
    });
  });
});
