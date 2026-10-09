import { describe, expect, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { printTable } from '~/lib/cli-utils';
import { implementation } from './licenses';

async function getOutput(full: boolean, outputJson = false) {
  const chunks: string[] = [];
  const context = {
    outputJson,
    printTable,
    process: { stdout: { write: (chunk: string) => chunks.push(chunk) } }
  } as unknown as LocalContext;
  await implementation.call(context, { full });
  return chunks.join('');
}

describe('licenses command', () => {
  test('prints the notice without the license texts', async () => {
    const output = await getOutput(false);
    expect(output).toContain('JavaScriptCore');
    expect(output).toContain('tinycc');
    expect(output).not.toContain('GNU LIBRARY GENERAL PUBLIC LICENSE');
    expect(output).not.toContain('GNU LESSER GENERAL PUBLIC LICENSE');
    expect(output).not.toContain('                    GNU GENERAL PUBLIC LICENSE');
    expect(output.endsWith('\n')).toBe(true);
  });

  test('prints the license texts with --full', async () => {
    const output = await getOutput(true);
    expect(output).toContain('JavaScriptCore');
    expect(output).toContain('GNU LIBRARY GENERAL PUBLIC LICENSE');
    expect(output).toContain('GNU LESSER GENERAL PUBLIC LICENSE');
    expect(output).toContain('                    GNU GENERAL PUBLIC LICENSE');
    expect(output.endsWith('\n')).toBe(true);
  });

  test('prints JSON with --json', async () => {
    const notice = JSON.parse(await getOutput(false, true));
    expect(Object.keys(notice)).toEqual(['notice']);
    expect(notice.notice).toContain('JavaScriptCore');

    const full = JSON.parse(await getOutput(true, true));
    expect(full['LGPL-2.0']).toContain('GNU LIBRARY GENERAL PUBLIC LICENSE');
    expect(full['LGPL-2.1']).toContain('GNU LESSER GENERAL PUBLIC LICENSE');
    expect(full['GPL-2.0']).toContain('GNU GENERAL PUBLIC LICENSE');
  });
});
