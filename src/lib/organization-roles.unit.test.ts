import { describe, expect, mock, test } from 'bun:test';
import type { LocalContext } from '~/context';
import { resolveInvitationRole } from './organization-roles';

type Options = {
  isInteractive?: boolean;
  outputJson?: boolean;
  promptedRole?: string;
};

function buildContext({ isInteractive = false, outputJson = false, promptedRole }: Options = {}) {
  const selectPrompt = mock(
    async (_isInteractive: boolean, _message: string, _choices: unknown[], _options?: unknown) => promptedRole ?? ''
  );

  const context = {
    isInteractive,
    outputJson,
    enquirer: { selectPrompt }
  } as unknown as LocalContext;

  return { context, selectPrompt };
}

describe('resolveInvitationRole', () => {
  test('returns the role given with --role', async () => {
    const { context, selectPrompt } = buildContext({ isInteractive: true });

    expect(await resolveInvitationRole(context, 'editor')).toBe('editor');
    expect(selectPrompt).not.toHaveBeenCalled();
  });

  test('omits the role when it cannot prompt', async () => {
    const { context, selectPrompt } = buildContext();

    expect(await resolveInvitationRole(context, undefined)).toBeUndefined();
    expect(selectPrompt).not.toHaveBeenCalled();
  });

  test('omits the role with --json even in a terminal', async () => {
    const { context, selectPrompt } = buildContext({ isInteractive: true, outputJson: true });

    expect(await resolveInvitationRole(context, undefined)).toBeUndefined();
    expect(selectPrompt).not.toHaveBeenCalled();
  });

  test('prompts in a terminal, starting on Viewer', async () => {
    const { context, selectPrompt } = buildContext({ isInteractive: true, promptedRole: 'admin' });

    expect(await resolveInvitationRole(context, undefined)).toBe('admin');
    expect(selectPrompt.mock.calls[0]?.[2]).toHaveLength(3);
    expect(selectPrompt.mock.calls[0]?.[3]).toEqual({ initial: 2 });
  });
});
