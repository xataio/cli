import { afterEach, describe, expect, test } from 'bun:test';
import { createServer, type Server } from 'node:net';
import type { LocalContext } from '~/context';
import { checkBranchIsReachable, isPortReachable } from './utils';

const servers: Server[] = [];

function addressOf(server: Server) {
  const address = server.address();
  return typeof address === 'object' && address ? address.port : 0;
}

function listen() {
  return new Promise<number>((resolve) => {
    const server = createServer();
    servers.push(server);
    server.listen(0, '127.0.0.1', () => {
      return resolve(addressOf(server));
    });
  });
}

/** A port nothing listens on: bound to learn a free one, then released. */
async function refusedPort() {
  const server = createServer();
  const port = await new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      return resolve(addressOf(server));
    });
  });
  await new Promise((resolve) => {
    return server.close(resolve);
  });
  return port;
}

function fakeContext(
  { publicAccess, port = 1 }: { publicAccess: boolean; port?: number },
  privateBranchTimeout = '300'
) {
  const stderr: string[] = [];
  const exitCodes: number[] = [];
  let credentialCalls = 0;

  const context = {
    api: {
      branches: {
        describeBranch: async () => {
          return { publicAccess };
        },
        getBranchCredentials: async () => {
          credentialCalls += 1;
          return { hostname: '127.0.0.1', port, connectionString: `postgresql://user:pass@127.0.0.1:${port}/xata` };
        }
      }
    },
    env: { XATA_PRIVATE_BRANCH_TIMEOUT: privateBranchTimeout },
    process: {
      stderr: {
        write: (chunk: string) => {
          stderr.push(chunk);
          return true;
        }
      },
      exit: (code: number) => {
        exitCodes.push(code);
      }
    },
    getOrganization: async () => {
      return 'org';
    },
    getProject: async () => {
      return 'project';
    },
    getBranch: async () => {
      return 'branch';
    }
  } as unknown as LocalContext;

  return {
    context,
    stderr,
    exitCodes,
    credentialCalls: () => {
      return credentialCalls;
    }
  };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => {
      return new Promise((resolve) => {
        return server.close(resolve);
      });
    })
  );
});

describe('isPortReachable', () => {
  test('is true for a port that accepts the connection', async () => {
    expect(await isPortReachable('127.0.0.1', await listen(), 1000)).toBe(true);
  });

  test('is false for a port that refuses the connection', async () => {
    expect(await isPortReachable('127.0.0.1', await refusedPort(), 1000)).toBe(false);
  });

  // The timeout is the one the caller asked for, not the OS connect timeout of about a minute
  // and not a fixed default. The bound sits below one second so a probe that ignores its
  // argument and falls back to the usual 1000ms default fails here.
  test('gives up after the timeout it was given', async () => {
    const startedAt = Date.now();
    // TEST-NET-1, reserved for documentation, so it black-holes rather than answering.
    expect(await isPortReachable('192.0.2.1', 5432, 200)).toBe(false);
    expect(Date.now() - startedAt).toBeLessThan(800);
  });
});

describe('checkBranchIsReachable', () => {
  test('leaves a public branch alone', async () => {
    const { context, exitCodes, credentialCalls } = fakeContext({ publicAccess: true });

    await checkBranchIsReachable(context, {});

    expect(credentialCalls()).toBe(0);
    expect(exitCodes).toEqual([]);
  });

  // Used to exit 1 for every private branch, answering or not, so `roll` and `clone` could
  // never run against one.
  test('returns without exiting when a private branch answers', async () => {
    const { context, stderr, exitCodes } = fakeContext({ publicAccess: false, port: await listen() });

    await checkBranchIsReachable(context, {});

    expect(exitCodes).toEqual([]);
    expect(stderr).toEqual([]);
  });

  test('exits 1 naming the escape hatch when a private branch stays silent', async () => {
    const { context, stderr, exitCodes } = fakeContext({ publicAccess: false, port: await refusedPort() });

    await checkBranchIsReachable(context, {});

    expect(exitCodes).toEqual([1]);
    expect(stderr.join('')).toContain('Private networking only');
    expect(stderr.join('')).toContain('XATA_PRIVATE_BRANCH_TIMEOUT=0');
  });

  // `clone start` and `clone stream` clone into what this returns. They used to read the
  // checked-out branch out of `.xata` instead, so `--branch` picked the branch to check and
  // then a different one to write to.
  test('returns the branch it resolved, so the caller writes to the one it checked', async () => {
    const { context } = fakeContext({ publicAccess: true });

    expect(await checkBranchIsReachable(context, {})).toEqual({
      organizationId: 'org',
      projectId: 'project',
      branchId: 'branch'
    });
  });

  test('returns the branch it resolved when the timeout is disabled', async () => {
    const { context } = fakeContext({ publicAccess: false, port: await refusedPort() }, '0');

    expect(await checkBranchIsReachable(context, {})).toEqual({
      organizationId: 'org',
      projectId: 'project',
      branchId: 'branch'
    });
  });

  test('skips the check when the timeout is disabled', async () => {
    const { context, exitCodes, credentialCalls } = fakeContext(
      { publicAccess: false, port: await refusedPort() },
      '0'
    );

    await checkBranchIsReachable(context, {});

    expect(credentialCalls()).toBe(0);
    expect(exitCodes).toEqual([]);
  });
});
