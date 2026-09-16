import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { printCustom } from '~/lib/cli-utils';
import { implementation } from './tree';

const branches = [
  { id: 'aaaaaaaaaaaaaaaaaaaaaaaaaa', name: 'main', parentID: null },
  { id: 'bbbbbbbbbbbbbbbbbbbbbbbbbb', name: 'dev', parentID: 'aaaaaaaaaaaaaaaaaaaaaaaaaa' },
  { id: 'cccccccccccccccccccccccccc', name: 'feature', parentID: 'bbbbbbbbbbbbbbbbbbbbbbbbbb' }
];

function buildContext(list: { id: string; name: string; parentID: string | null }[] = branches) {
  const stdout: string[] = [];
  const context = {
    api: { branches: { listBranches: mock(async () => ({ branches: list })) } },
    process: { stdout: { write: (value: string) => stdout.push(value) }, stderr: { write: () => {} } },
    isInteractive: false,
    isAgent: false,
    getOrganization: mock(async () => 'org-id'),
    getProject: mock(async () => 'project-id'),
    getBranch: mock(async () => 'bbbbbbbbbbbbbbbbbbbbbbbbbb'),
    printCustom
  } as unknown as LocalContext;

  return { context, stdout };
}

describe('branch tree', () => {
  test('nests the JSON, which is the only thing it adds over branch list', async () => {
    const { context, stdout } = buildContext();

    await implementation.call({ ...context, outputJson: true }, { 'show-id': false });

    const roots = JSON.parse(stdout.join(''));
    expect(roots).toHaveLength(1);
    expect(roots[0].name).toBe('main');
    expect(roots[0].children[0].name).toBe('dev');
    expect(roots[0].children[0].children[0].name).toBe('feature');
    expect(roots[0].children[0].children[0].children).toEqual([]);
  });

  test('carries the current branch, which the human tree marks with (current)', async () => {
    const { context, stdout } = buildContext();

    await implementation.call({ ...context, outputJson: true }, { 'show-id': false });

    const roots = JSON.parse(stdout.join(''));
    expect(roots[0].current).toBe(false);
    expect(roots[0].children[0].current).toBe(true);
  });

  test('still draws the tree when JSON is not asked for', async () => {
    const { context, stdout } = buildContext();

    await implementation.call({ ...context, outputJson: false }, { 'show-id': false });

    const output = stdout.join('');
    expect(output).toContain('main');
    expect(output).toContain('dev (current)');
    expect(output).toContain('feature');
    expect(output).not.toContain('"children"');
  });

  test('keeps a branch whose parent is not listed, as a root of its own', async () => {
    const orphan = { id: 'dddddddddddddddddddddddddd', name: 'orphan', parentID: 'zzzzzzzzzzzzzzzzzzzzzzzzzz' };
    const json = buildContext([...branches, orphan]);
    const human = buildContext([...branches, orphan]);

    await implementation.call({ ...json.context, outputJson: true }, { 'show-id': false });
    await implementation.call({ ...human.context, outputJson: false }, { 'show-id': false });

    const roots = JSON.parse(json.stdout.join(''));
    expect(roots.map((root: { name: string }) => root.name)).toEqual(['main', 'orphan']);
    expect(roots[1].children).toEqual([]);
    expect(roots[0].children[0].children[0].name).toBe('feature');
    expect(human.stdout.join('')).toContain('orphan');
  });
});
