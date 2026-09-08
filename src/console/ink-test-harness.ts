// Adapted from https://github.com/vadimdemedes/ink-testing-library/blob/main/source/index.ts
import { render } from 'ink';
import { EventEmitter } from 'node:events';
import type { ReactElement } from 'react';
import stripAnsi from 'strip-ansi';

class FakeStdout extends EventEmitter {
  columns = 120;
  frames: string[] = [];

  write = (frame: string) => {
    this.frames.push(frame);
    return true;
  };
}

class FakeStdin extends EventEmitter {
  isTTY = true;
  private chunk: string | null = null;

  write = (data: string) => {
    this.chunk = data;
    this.emit('readable');
  };

  read = () => {
    const chunk = this.chunk;
    this.chunk = null;
    return chunk;
  };

  setEncoding() {}
  setRawMode() {}
  resume() {}
  pause() {}
  ref() {}
  unref() {}
}

export function renderInk(element: ReactElement) {
  const stdout = new FakeStdout();
  const stdin = new FakeStdin();
  const instance = render(element, {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false
  });

  return {
    lastFrame: () => stripAnsi(stdout.frames.at(-1) ?? ''),
    press: (key: string) => stdin.write(key),
    unmount: () => instance.unmount()
  };
}

export function settle() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

export async function waitFor(assertion: () => void, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
}
