import { afterEach, describe, expect, jest, mock, spyOn, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import type { LocalContext } from '~/context';
import { runScratchHandoff } from './scratch-handoff';

const handoff = {
  kind: 'scratch-psql',
  organizationId: 'org',
  projectId: 'project',
  parentBranchId: 'parent',
  parentBranchName: 'main',
  database: 'app'
} as const;

function buildFixture() {
  const creation = Promise.withResolvers<{ id: string; name: string }>();
  const ready = Promise.withResolvers<{ status: { statusType: string } }>();
  const credentials = Promise.withResolvers<{ connectionString: string }>();
  const deletion = Promise.withResolvers<void>();
  const child = Promise.withResolvers<number>();
  const branch = { id: 'scratch-id', name: '' };
  const errors: string[] = [];
  const process = Object.assign(new EventEmitter(), {
    stderr: { write: (value: string) => errors.push(value) },
    stdin: { isTTY: false, pause: mock(() => {}) },
    exit: mock((code: number) => {
      throw new Error(`exit ${code}`);
    })
  });
  const api = {
    branches: {
      createBranch: mock(({ body }: { body: { name: string } }) => {
        branch.name = body.name;
        return creation.promise;
      }),
      listBranches: mock(async () => ({ branches: [{ id: 'unrelated', name: 'scratch-other' }, branch] })),
      describeBranch: mock(() => ready.promise),
      getBranchCredentials: mock(() => credentials.promise),
      deleteBranch: mock(() => deletion.promise)
    }
  };
  const context = { process, api } as unknown as LocalContext;
  const spawn = spyOn(Bun, 'spawn').mockReturnValue({ exited: child.promise } as ReturnType<typeof Bun.spawn>);
  return { context, process, api, creation, ready, credentials, deletion, child, branch, spawn, errors };
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => mock.restore());

describe('console scratch handoff', () => {
  test('recovers the exact generated branch when creation response never arrives', async () => {
    const fixture = buildFixture();
    const result = runScratchHandoff(fixture.context, handoff, 'psql');
    const outcome = result.catch((error: unknown) => error);
    fixture.process.emit('SIGINT');
    await flush();

    expect(fixture.api.branches.listBranches).toHaveBeenCalledWith({
      pathParams: { organizationID: 'org', projectID: 'project' }
    });
    expect(fixture.api.branches.deleteBranch).toHaveBeenCalledWith({
      pathParams: { organizationID: 'org', projectID: 'project', branchID: 'scratch-id' }
    });
    expect(fixture.process.exit).not.toHaveBeenCalled();
    fixture.process.emit('SIGINT');
    expect(fixture.process.exit).not.toHaveBeenCalled();
    fixture.deletion.resolve();
    expect(await outcome).toEqual(new Error('exit 130'));
    expect(fixture.spawn).not.toHaveBeenCalled();
    expect(fixture.process.listenerCount('SIGINT')).toBe(0);

    fixture.creation.resolve(fixture.branch);
    await flush();
    expect(fixture.api.branches.deleteBranch).toHaveBeenCalledTimes(1);
    expect(fixture.api.branches.describeBranch).not.toHaveBeenCalled();
  });

  test('uses the eventual create response when name lookup is still pending', async () => {
    const fixture = buildFixture();
    fixture.api.branches.listBranches.mockImplementation(() => new Promise(() => {}));
    const result = runScratchHandoff(fixture.context, handoff, 'psql');
    const outcome = result.catch((error: unknown) => error);
    fixture.process.emit('SIGINT');
    fixture.creation.resolve(fixture.branch);
    fixture.deletion.resolve();
    expect(await outcome).toEqual(new Error('exit 130'));
    expect(fixture.api.branches.deleteBranch).toHaveBeenCalledTimes(1);
    expect(fixture.spawn).not.toHaveBeenCalled();
  });

  test('cleans up after a lost creation response without deleting unrelated branches', async () => {
    const fixture = buildFixture();
    const result = runScratchHandoff(fixture.context, handoff, 'psql');
    const outcome = result.catch((error: unknown) => error);
    fixture.creation.reject(new Error('response lost'));
    fixture.deletion.resolve();
    expect(await outcome).toEqual(new Error('response lost'));
    expect(fixture.api.branches.deleteBranch).toHaveBeenCalledWith({
      pathParams: { organizationID: 'org', projectID: 'project', branchID: 'scratch-id' }
    });
    expect(fixture.process.listenerCount('SIGINT')).toBe(0);
  });

  test('waits for the create response after lookup fails and completes deletion before exiting', async () => {
    const fixture = buildFixture();
    fixture.api.branches.listBranches.mockRejectedValue(new Error('lookup unavailable'));
    const outcome = runScratchHandoff(fixture.context, handoff, 'psql').catch((error: unknown) => error);
    fixture.process.emit('SIGINT');
    await flush();
    expect(fixture.api.branches.listBranches).toHaveBeenCalledTimes(1);
    expect(fixture.process.exit).not.toHaveBeenCalled();
    expect(fixture.errors.join('')).not.toContain('could not confirm cleanup');

    fixture.creation.resolve(fixture.branch);
    await flush();
    expect(fixture.api.branches.deleteBranch).toHaveBeenCalledTimes(1);
    expect(fixture.api.branches.deleteBranch).toHaveBeenCalledWith({
      pathParams: { organizationID: 'org', projectID: 'project', branchID: 'scratch-id' }
    });
    fixture.process.emit('SIGINT');
    expect(fixture.process.exit).not.toHaveBeenCalled();
    fixture.deletion.resolve();
    expect(await outcome).toEqual(new Error('exit 130'));
    expect(fixture.spawn).not.toHaveBeenCalled();
    expect(fixture.process.listenerCount('SIGINT')).toBe(0);
  });

  test('retries unavailable lookup when the create response is lost', async () => {
    const fixture = buildFixture();
    fixture.api.branches.listBranches.mockRejectedValueOnce(new Error('lookup unavailable'));
    const outcome = runScratchHandoff(fixture.context, handoff, 'psql').catch((error: unknown) => error);
    fixture.creation.reject(new Error('response lost'));
    fixture.deletion.resolve();
    expect(await outcome).toEqual(new Error('response lost'));
    expect(fixture.api.branches.listBranches).toHaveBeenCalledTimes(2);
    expect(fixture.api.branches.deleteBranch).toHaveBeenCalledTimes(1);
    expect(fixture.spawn).not.toHaveBeenCalled();
  });

  test('does not suppress ambiguous exact-name matches', async () => {
    const fixture = buildFixture();
    fixture.api.branches.listBranches.mockImplementation(async () => ({
      branches: [fixture.branch, { ...fixture.branch, id: 'other-id' }]
    }));
    const outcome = runScratchHandoff(fixture.context, handoff, 'psql').catch((error: unknown) => error);
    fixture.process.emit('SIGINT');
    expect(await outcome).toEqual(new Error('exit 130'));
    expect(fixture.errors.join('')).toContain('Multiple branches match the generated scratch name');
    expect(fixture.api.branches.deleteBranch).not.toHaveBeenCalled();
    expect(fixture.spawn).not.toHaveBeenCalled();
  });

  test('bounds cleanup when creation and lookup stay pending', async () => {
    const fixture = buildFixture();
    const lookupStarted = Promise.withResolvers<void>();
    fixture.api.branches.listBranches.mockImplementation(() => {
      lookupStarted.resolve();
      return new Promise(() => {});
    });

    jest.useFakeTimers();
    const outcome = runScratchHandoff(fixture.context, handoff, 'psql').catch((error: unknown) => error);
    fixture.process.emit('SIGINT');
    try {
      await lookupStarted.promise;
      jest.advanceTimersByTime(10_000);
    } finally {
      jest.useRealTimers();
    }

    expect(await outcome).toEqual(new Error('exit 130'));
    expect(fixture.errors.join('')).toContain('Timed out cleaning up scratch branch');
    expect(fixture.errors.join('')).toContain(
      `--organization org --project project --branch ${fixture.branch.name} --yes`
    );
    expect(fixture.api.branches.deleteBranch).not.toHaveBeenCalled();
    expect(fixture.process.listenerCount('SIGINT')).toBe(0);
    expect(fixture.spawn).not.toHaveBeenCalled();
  });

  test.each(['readiness', 'credentials'] as const)(
    'cancels an in-flight %s request before spawning psql',
    async (phase) => {
      const fixture = buildFixture();
      const result = runScratchHandoff(fixture.context, handoff, 'psql');
      const outcome = result.catch((error: unknown) => error);
      fixture.creation.resolve(fixture.branch);
      await flush();
      if (phase === 'credentials') {
        fixture.ready.resolve({ status: { statusType: 'STATUS_TYPE_HEALTHY' } });
        await flush();
        expect(fixture.api.branches.getBranchCredentials).toHaveBeenCalledTimes(1);
      }
      fixture.process.emit('SIGINT');
      fixture.deletion.resolve();
      expect(await outcome).toEqual(new Error('exit 130'));
      fixture.ready.resolve({ status: { statusType: 'STATUS_TYPE_HEALTHY' } });
      fixture.credentials.resolve({ connectionString: 'postgres://user:pass@localhost/app' });
      await flush();
      expect(fixture.spawn).not.toHaveBeenCalled();
      expect(fixture.api.branches.deleteBranch).toHaveBeenCalledTimes(1);
      expect(fixture.api.branches.listBranches).not.toHaveBeenCalled();
      expect(fixture.process.listenerCount('SIGINT')).toBe(0);
    }
  );

  test('leaves Ctrl+C to psql, then deletes once and returns normally', async () => {
    const fixture = buildFixture();
    const result = runScratchHandoff(fixture.context, handoff, 'psql');
    fixture.creation.resolve(fixture.branch);
    fixture.ready.resolve({ status: { statusType: 'STATUS_TYPE_HEALTHY' } });
    fixture.credentials.resolve({ connectionString: 'postgres://user:pass@localhost/app' });
    await flush();
    expect(fixture.spawn).toHaveBeenCalledTimes(1);
    fixture.process.emit('SIGINT');
    expect(fixture.api.branches.deleteBranch).not.toHaveBeenCalled();
    expect(fixture.process.exit).not.toHaveBeenCalled();
    fixture.child.resolve(0);
    fixture.deletion.resolve();
    await result;
    expect(fixture.api.branches.deleteBranch).toHaveBeenCalledTimes(1);
    expect(fixture.process.exit).not.toHaveBeenCalled();
    expect(fixture.process.listenerCount('SIGINT')).toBe(0);
  });

  test('keeps owning repeated Ctrl+C until normal deletion finishes', async () => {
    const fixture = buildFixture();
    const result = runScratchHandoff(fixture.context, handoff, 'psql');
    const outcome = result.catch((error: unknown) => error);
    fixture.creation.resolve(fixture.branch);
    fixture.ready.resolve({ status: { statusType: 'STATUS_TYPE_HEALTHY' } });
    fixture.credentials.resolve({ connectionString: 'postgres://user:pass@localhost/app' });
    fixture.child.resolve(0);
    await flush();
    expect(fixture.api.branches.deleteBranch).toHaveBeenCalledTimes(1);
    fixture.process.emit('SIGINT');
    fixture.process.emit('SIGINT');
    expect(fixture.process.exit).not.toHaveBeenCalled();
    fixture.deletion.resolve();
    expect(await outcome).toEqual(new Error('exit 130'));
    expect(fixture.api.branches.deleteBranch).toHaveBeenCalledTimes(1);
    expect(fixture.process.listenerCount('SIGINT')).toBe(0);
  });

  test('reports scoped manual cleanup when deletion fails', async () => {
    const fixture = buildFixture();
    const result = runScratchHandoff(fixture.context, handoff, 'psql');
    const outcome = result.catch((error: unknown) => error);
    fixture.process.emit('SIGINT');
    await flush();
    fixture.deletion.reject(new Error('delete unavailable'));
    expect(await outcome).toEqual(new Error('exit 130'));
    expect(fixture.errors.join('')).toContain('could not confirm cleanup');
    expect(fixture.errors.join('')).toContain('--organization org --project project --branch scratch-id --yes');
  });
});
