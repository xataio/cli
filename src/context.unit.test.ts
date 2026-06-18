import { describe, expect, test } from 'bun:test';
import { getIsInteractive } from './context';

function buildProcess({ stdinIsTTY, stdoutIsTTY }: { stdinIsTTY: boolean; stdoutIsTTY: boolean }) {
  return {
    stdin: { isTTY: stdinIsTTY },
    stdout: { isTTY: stdoutIsTTY },
    stderr: { write: () => {} }
  } as unknown as NodeJS.Process;
}

describe('buildContext', () => {
  test('is interactive when stdin and stdout are TTYs', async () => {
    const isInteractive = getIsInteractive(buildProcess({ stdinIsTTY: true, stdoutIsTTY: true }), {
      isCI: false,
      isAgent: false
    });

    expect(isInteractive).toBe(true);
  });

  test('is non-interactive when stdout is captured', async () => {
    const isInteractive = getIsInteractive(buildProcess({ stdinIsTTY: true, stdoutIsTTY: false }), {
      isCI: false,
      isAgent: false
    });

    expect(isInteractive).toBe(false);
  });

  test('is non-interactive when stdin is not a TTY', async () => {
    const isInteractive = getIsInteractive(buildProcess({ stdinIsTTY: false, stdoutIsTTY: true }), {
      isCI: false,
      isAgent: false
    });

    expect(isInteractive).toBe(false);
  });

  test('is non-interactive in CI or agentic contexts', async () => {
    const process = buildProcess({ stdinIsTTY: true, stdoutIsTTY: true });

    expect(getIsInteractive(process, { isCI: true, isAgent: false })).toBe(false);
    expect(getIsInteractive(process, { isCI: false, isAgent: true })).toBe(false);
  });
});
