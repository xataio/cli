import { Box, Text, useInput, type Key } from 'ink';
import { useState } from 'react';

type Draft = { text: string; cursor: number };
type SQLEditorProps = {
  sql: string;
  columns: number;
  rows: number;
  isActive: boolean;
  onSave: (sql: string) => void;
  onCancel: () => void;
};

const position = ({ text, cursor }: Draft) => {
  const before = Array.from(text).slice(0, cursor).join('').split('\n');
  return { line: before.length - 1, column: Array.from(before.at(-1) ?? '').length };
};

const editDraft = (draft: Draft, input: string, key: Key): Draft => {
  const characters = Array.from(draft.text);
  const { line, column } = position(draft);
  const lines = draft.text.split('\n').map((text) => Array.from(text));
  const start = draft.cursor - column;
  if (key.home) return { ...draft, cursor: key.ctrl ? 0 : start };
  if (key.end) return { ...draft, cursor: key.ctrl ? characters.length : start + lines[line]!.length };
  if (key.leftArrow) return { ...draft, cursor: Math.max(0, draft.cursor - 1) };
  if (key.rightArrow) return { ...draft, cursor: Math.min(characters.length, draft.cursor + 1) };
  if (key.upArrow && line > 0) {
    const previousLength = lines[line - 1]!.length;
    return { ...draft, cursor: start - previousLength - 1 + Math.min(column, previousLength) };
  }
  if (key.downArrow && line < lines.length - 1) {
    return { ...draft, cursor: start + lines[line]!.length + 1 + Math.min(column, lines[line + 1]!.length) };
  }
  if (key.backspace || key.delete) {
    const cursor = key.backspace ? Math.max(0, draft.cursor - 1) : draft.cursor;
    if (key.backspace && draft.cursor === 0) return draft;
    characters.splice(cursor, 1);
    return { text: characters.join(''), cursor };
  }
  if (key.ctrl && input === 'u') return { text: '', cursor: 0 };
  if (key.ctrl || key.meta || key.upArrow || key.downArrow || key.pageUp || key.pageDown) return draft;
  const text = key.return ? '\n' : key.tab ? '  ' : input.replace(/\r\n?/g, '\n').replace(/[^\P{Cc}\n\t]/gu, '');
  characters.splice(draft.cursor, 0, ...Array.from(text));
  return { text: characters.join(''), cursor: draft.cursor + Array.from(text).length };
};

export const SQLEditor = ({ sql, columns, rows, isActive, onSave, onCancel }: SQLEditorProps) => {
  const [draft, setDraft] = useState<Draft>({ text: sql, cursor: 0 });
  const [error, setError] = useState('');
  const caret = position(draft);
  const lines = draft.text.split('\n').map((text, number) => ({ characters: Array.from(text), number }));
  const height = Math.max(1, rows - 5);
  const top = Math.max(0, caret.line - height + 1);
  let left = Math.max(0, caret.column - columns + 12);
  while (
    left < caret.column &&
    Bun.stringWidth(lines[caret.line]!.characters.slice(left, caret.column).join('')) > columns - 12
  )
    left++;

  useInput(
    (input, key) => {
      if (key.escape) {
        onCancel();
        return;
      }
      if (key.ctrl && input === 's') {
        if (!draft.text.trim()) {
          setError('SQL cannot be empty.');
          return;
        }
        onSave(draft.text);
        return;
      }
      setError('');
      setDraft((previous) => editDraft(previous, input, key));
    },
    { isActive }
  );

  return (
    <Box flexDirection="column" width={columns}>
      <Text bold color="cyan">
        Edit SQL · changes are reviewed before execution
      </Text>
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        height={height + 2}
        flexDirection="column"
        overflow="hidden"
      >
        {lines.slice(top, top + height).map(({ characters, number }) => (
          <Text key={number} wrap="truncate-end">
            <Text color="gray">{String(number + 1).padStart(3)} </Text>
            {number === caret.line ? (
              <>
                {characters.slice(left, caret.column).join('')}
                <Text inverse>{characters[caret.column] ?? ' '}</Text>
                {characters.slice(caret.column + 1).join('')}
              </>
            ) : (
              characters.slice(left).join('')
            )}
          </Text>
        ))}
      </Box>
      <Text color={error ? 'red' : 'gray'}>{error || `Line ${caret.line + 1}, column ${caret.column + 1}`}</Text>
      <Text color="gray" wrap="truncate-end">
        ctrl+s review · esc discard · ctrl+u clear · ctrl+c quit
      </Text>
    </Box>
  );
};
