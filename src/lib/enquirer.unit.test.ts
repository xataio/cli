import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { PassThrough } from 'node:stream';
import enquirer from 'enquirer';
import stripAnsi from 'strip-ansi';
import { multiselectPrompt } from './enquirer';

afterEach(() => mock.restore());

const choices = [
  { name: 'claude-code', message: 'Claude Code' },
  { name: 'opencode', message: 'OpenCode' }
];

type InteractivePrompt = {
  once: (event: string, listener: () => void) => void;
  keypress: (input: string) => Promise<void>;
  close: () => Promise<void>;
  choices: { name: string; message: string }[];
  selected: { name: string }[];
  state: { buffer: string };
};

const interact = async (action: (prompt: InteractivePrompt) => Promise<void>) => {
  const runner = new enquirer<{ value: string[] }>({ show: false, stdout: new PassThrough() });
  const ready = new Promise<InteractivePrompt>((resolve) => {
    runner.once('prompt', (prompt: InteractivePrompt) => prompt.once('run', () => resolve(prompt)));
  });
  const runPrompt = enquirer.prototype.prompt;
  spyOn(enquirer.prototype, 'prompt').mockImplementation((question) => runPrompt.call(runner, question));
  const result = multiselectPrompt(
    true,
    'Agents',
    [...choices, { name: 'windsurf', message: 'Windsurf' }],
    ['claude-code'],
    { searchable: true }
  );
  const prompt = await ready;
  try {
    await action(prompt);
    await prompt.keypress('\r');
    return await result;
  } finally {
    await prompt.close();
  }
};

test('real autocomplete retains hidden selections through filtering', async () => {
  const result = await interact(async (prompt) => {
    for (const character of 'open') await prompt.keypress(character);
    expect(prompt.choices.map((choice) => choice.name)).toEqual(['opencode']);
    await prompt.keypress(' ');
    expect(prompt.selected.map((choice) => choice.name)).toEqual(['claude-code', 'opencode']);
    for (let index = 0; index < 4; index++) await prompt.keypress('\x7f');
    for (const character of 'wind') await prompt.keypress(character);
    expect(prompt.choices.map((choice) => choice.name)).toEqual(['windsurf']);
    await prompt.keypress(' ');
    expect(prompt.selected.map((choice) => choice.name)).toEqual(['claude-code', 'opencode', 'windsurf']);
    await prompt.keypress(' ');
    expect(prompt.selected.map((choice) => choice.name)).toEqual(['claude-code', 'opencode']);
    await prompt.keypress('!');
    expect(prompt.choices).toEqual([]);
    expect(stripAnsi(prompt.state.buffer)).toContain('No matching choices');
    await prompt.keypress('\x7f');
  });
  expect(result).toEqual(['claude-code', 'opencode']);
});

test('searchable multiselect enables autocomplete while preserving selections and validation', async () => {
  const prompt = spyOn(enquirer.prototype, 'prompt').mockResolvedValue({ value: ['claude-code', 'opencode'] });
  expect(await multiselectPrompt(true, 'Agents', choices, ['claude-code'], { searchable: true })).toEqual([
    'claude-code',
    'opencode'
  ]);
  expect(prompt).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'autocomplete',
      multiple: true,
      initial: ['claude-code'],
      choices,
      hint: 'Type to filter, Space to toggle, Enter to confirm'
    })
  );
  const options = prompt.mock.calls[0]?.[0] as unknown as { validate: (value: string[]) => boolean | string };
  expect(options.validate([])).toBe('You must select at least one option');
  expect(options.validate(['opencode'])).toBe(true);
});

test('existing multiselect callers retain their prompt type; noninteractive calls never prompt', async () => {
  const prompt = spyOn(enquirer.prototype, 'prompt').mockResolvedValue({ value: ['opencode'] });
  expect(await multiselectPrompt(true, 'Agents', choices, [])).toEqual(['opencode']);
  expect(prompt).toHaveBeenCalledWith(expect.objectContaining({ type: 'multiselect', initial: [] }));
  prompt.mockClear();
  expect(await multiselectPrompt(false, 'Agents', choices, ['opencode'], { searchable: true })).toEqual([]);
  expect(prompt).not.toHaveBeenCalled();
});
