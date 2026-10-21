import { describe, expect, mock, test } from 'bun:test';
import { setTimeout as delay } from 'node:timers/promises';
import { ApiError } from '@xata.io/api';
import type { LocalContext } from '~/context';
import { implementation } from './restore';
import { parseRestoreTime, parseTimeout, windowError } from './restore-utils';

const WINDOW = {
  earliestRestore: '2026-10-10T00:00:00Z',
  latestRestore: '2026-10-20T12:00:00Z'
};
const WINDOW_TEXT = '2026-10-10 00:00:00 UTC to 2026-10-20 12:00:00 UTC';
const NOW = new Date('2026-10-20T12:03:00Z');

describe('parseRestoreTime', () => {
  test('normalizes Z and numeric offsets to UTC', () => {
    expect(parseRestoreTime('2026-10-20T10:00:00Z')).toBe('2026-10-20T10:00:00.000Z');
    expect(parseRestoreTime('2026-10-20T12:00:00+02:00')).toBe('2026-10-20T10:00:00.000Z');
    expect(parseRestoreTime('2026-10-20T10:00:00.250-01:30')).toBe('2026-10-20T11:30:00.250Z');
  });

  test.each([
    '2026-10-20T10:00:00',
    '2026-10-20',
    '2026-10-20 10:00:00Z',
    'yesterday',
    '2026-02-30T10:00:00Z',
    '2026-13-01T10:00:00Z',
    '2026-10-20T24:00:00Z',
    '2026-10-20T10:00:00+25:00'
  ])('rejects %p', (value) => {
    expect(parseRestoreTime(value)).toBeUndefined();
  });
});

describe('parseTimeout', () => {
  test('converts durations to milliseconds', () => {
    expect(parseTimeout('90s')).toBe(90_000);
    expect(parseTimeout('30m')).toBe(1_800_000);
    expect(parseTimeout('2h')).toBe(7_200_000);
  });

  test.each(['30', '0m', '-5m', '1d', 'abc'])('rejects %p', (value) => {
    expect(parseTimeout(value)).toBeUndefined();
  });
});

describe('windowError', () => {
  test('accepts the whole window, including the latest recovery point', () => {
    expect(windowError('2026-10-15T00:00:00Z', WINDOW, NOW)).toBeNull();
    expect(windowError('2026-10-20T12:00:00Z', WINDOW, NOW)).toBeNull();
  });

  test('rejects a time before the window and prints the window', () => {
    const error = windowError('2026-10-01T00:00:00Z', WINDOW, NOW);
    expect(error).toContain('before the earliest recovery point');
    expect(error).toContain(WINDOW_TEXT);
  });

  test('rejects a time after the latest recovery point', () => {
    expect(windowError('2026-10-20T12:01:30Z', WINDOW, NOW)).toContain('after the latest recovery point');
  });

  test('rejects a time in the future', () => {
    expect(windowError('2026-10-21T00:00:00Z', WINDOW, NOW)).toContain('in the future');
  });
});

const HEALTHY = { statusType: 'STATUS_TYPE_HEALTHY', status: 'Healthy' };
const FAULT = { statusType: 'STATUS_TYPE_FAULT', status: 'Setting up cluster' };

type ContextOptions = {
  isInteractive?: boolean;
  confirmed?: boolean;
  restoreError?: Error;
  window?: { earliestRestore?: string; latestRestore?: string };
  statuses?: Array<{ statusType: string; status: string }>;
};

function buildContext({
  isInteractive = false,
  confirmed = true,
  restoreError,
  window = WINDOW,
  statuses = [HEALTHY]
}: ContextOptions = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const restoreFromBackup = mock(async (_args: { body: { name: string; targetTime?: string } }) => {
    if (restoreError) {
      throw restoreError;
    }
    return { id: 'new-id', name: 'restored', createdAt: '2026-10-20T12:00:00Z', parentID: 'src-id' };
  });
  let polls = 0;
  const describeBranch = mock(async ({ pathParams }: { pathParams: { branchID: string } }) =>
    pathParams.branchID === 'src-id'
      ? { id: 'src-id', name: 'main' }
      : { id: 'new-id', name: 'restored', status: statuses[Math.min(polls++, statuses.length - 1)] }
  );
  const confirmPrompt = mock(async (_isInteractive: boolean, _message: string) => confirmed);

  const context = {
    api: {
      branches: { restoreFromBackup, describeBranch },
      projects: { getBackup: mock(async () => ({ id: 'src-id', branchID: 'src-id', description: '', ...window })) }
    },
    process: {
      stdout: { write: (value: string) => stdout.push(value) },
      stderr: { write: (value: string) => stderr.push(value) },
      exit: mock((code?: number) => {
        throw new Error(`exit:${code}`);
      })
    },
    isInteractive,
    outputJson: true,
    printDetails: (_context: LocalContext, data: Record<string, unknown>) => {
      stdout.push(JSON.stringify(data));
    },
    getOrganization: mock(async () => 'org-id'),
    getProject: mock(async () => 'project-id'),
    getBranch: mock(async () => 'src-id'),
    enquirer: {
      inputPrompt: mock(async (_interactive: boolean, _title: string, options?: { flag?: string }) => options?.flag),
      confirmPrompt
    }
  } as unknown as LocalContext;

  return { context, stdout, stderr, restoreFromBackup, confirmPrompt };
}

const baseFlags = { name: 'restored', wait: false, yes: true };

describe('restore implementation', () => {
  test('restores to the latest recovery point and prints the branch', async () => {
    const { context, stdout, restoreFromBackup } = buildContext();

    await implementation.call(context, baseFlags, 'main');

    expect(restoreFromBackup).toHaveBeenCalledTimes(1);
    expect(restoreFromBackup.mock.calls[0]?.[0]).toMatchObject({
      pathParams: { branchID: 'src-id' },
      body: { name: 'restored', targetTime: undefined }
    });
    expect(context.getBranch).toHaveBeenCalledWith(context, baseFlags, {
      organizationId: 'org-id',
      projectId: 'project-id',
      branchName: 'main'
    });
    expect(JSON.parse(stdout.join(''))).toMatchObject({ id: 'new-id', parentID: 'src-id' });
  });

  test('sends the target time in UTC', async () => {
    const { context, restoreFromBackup } = buildContext();

    await implementation.call(context, { ...baseFlags, to: '2026-10-15T02:00:00+02:00' });

    expect(restoreFromBackup.mock.calls[0]?.[0].body.targetTime).toBe('2026-10-15T00:00:00.000Z');
  });

  test.each([
    ['a target outside the window', { to: '2026-01-01T00:00:00Z' }],
    ['a target time without an offset', { to: '2026-10-15T00:00:00' }],
    ['--timeout without --wait', { timeout: '5m' }]
  ])('rejects %s before calling the API', async (_label, flags) => {
    const { context, restoreFromBackup } = buildContext();

    await expect(implementation.call(context, { ...baseFlags, ...flags })).rejects.toThrow('exit:1');
    expect(restoreFromBackup).not.toHaveBeenCalled();
  });

  test('prints the window when the target is outside it', async () => {
    const { context, stderr } = buildContext();

    await expect(implementation.call(context, { ...baseFlags, to: '2026-01-01T00:00:00Z' })).rejects.toThrow('exit:1');
    expect(stderr.join('')).toContain(WINDOW_TEXT);
  });

  test('refuses to run without --yes outside a terminal', async () => {
    const { context, restoreFromBackup } = buildContext();

    await expect(implementation.call(context, { ...baseFlags, yes: false })).rejects.toThrow('exit:1');
    expect(restoreFromBackup).not.toHaveBeenCalled();
  });

  test('does not restore when the confirmation is declined', async () => {
    const { context, restoreFromBackup, confirmPrompt } = buildContext({ isInteractive: true, confirmed: false });

    await expect(implementation.call(context, { ...baseFlags, yes: false })).rejects.toThrow('exit:1');
    expect(confirmPrompt).toHaveBeenCalledTimes(1);
    expect(restoreFromBackup).not.toHaveBeenCalled();
  });

  test('reports a source without a recovery point', async () => {
    const { context, stderr, restoreFromBackup } = buildContext({ window: {} });

    await expect(implementation.call(context, baseFlags)).rejects.toThrow('exit:1');
    expect(stderr.join('')).toContain('no recovery point');
    expect(restoreFromBackup).not.toHaveBeenCalled();
  });

  test('maps a 412 from the API', async () => {
    const { context, stderr } = buildContext({ restoreError: new ApiError(412, {}, 'nope') });

    await expect(implementation.call(context, baseFlags)).rejects.toThrow('exit:1');
    expect(stderr.join('')).toContain('no recovery point');
  });

  test('maps a 400 and prints the window only for a target time', async () => {
    const restoreError = new ApiError(400, {}, 'bad name');
    const latest = buildContext({ restoreError });
    await expect(implementation.call(latest.context, baseFlags)).rejects.toThrow('exit:1');
    expect(latest.stderr.join('')).toContain('bad name');
    expect(latest.stderr.join('')).not.toContain('restore window');

    const timed = buildContext({ restoreError });
    await expect(implementation.call(timed.context, { ...baseFlags, to: '2026-10-15T00:00:00Z' })).rejects.toThrow(
      'exit:1'
    );
    expect(timed.stderr.join('')).toContain(WINDOW_TEXT);
  });

  test('keeps polling through a transient FAULT until the branch is healthy', async () => {
    const { context, stdout } = buildContext({ statuses: [FAULT, HEALTHY] });

    await implementation.call(context, { ...baseFlags, wait: true });

    expect(JSON.parse(stdout.join(''))).toMatchObject({ id: 'new-id', status: HEALTHY });
  });

  test('reports the branch id and last status when --wait times out', async () => {
    const { context, stderr } = buildContext({ statuses: [FAULT] });
    const startedAt = Date.now();

    await expect(implementation.call(context, { ...baseFlags, wait: true, timeout: '1s' })).rejects.toThrow('exit:1');
    expect(Date.now() - startedAt).toBeLessThan(2000);
    const output = JSON.parse(stderr.at(-1) ?? '');
    expect(output).toMatchObject({ success: false, branchId: 'new-id', name: 'restored' });
    expect(output.error).toContain('Setting up cluster');
  });

  test('times out before a pending status request returns healthy', async () => {
    const { context, stderr, stdout } = buildContext();
    const describeBranch = context.api.branches.describeBranch;
    context.api.branches.describeBranch = async (args) => {
      if (args.pathParams.branchID === 'new-id') await delay(3000);
      return describeBranch(args);
    };
    const startedAt = Date.now();

    await expect(implementation.call(context, { ...baseFlags, wait: true, timeout: '1s' })).rejects.toThrow('exit:1');

    expect(Date.now() - startedAt).toBeLessThan(2000);
    expect(stdout).toEqual([]);
    const output = JSON.parse(stderr.at(-1) ?? '');
    expect(output).toMatchObject({ success: false, branchId: 'new-id', name: 'restored' });
    expect(output.error).toContain('Timed out waiting');
    expect(output.error).toContain('Last status: Not yet available');
  });
});
