import { Box, Text, useInput } from 'ink';
import { useEffect, useRef, useState } from 'react';
import { ConfirmModal } from '~/console/components/confirm-modal';
import { getErrorMessage } from '~/lib/cli-utils';
import { createTable } from '~/lib/table';
import { SQLEditor } from './sql-editor';

export type SQLResult = {
  command: string;
  count: number | null;
  columns: string[];
  rows: Record<string, unknown>[];
};

export type SQLViewProps = {
  target: string;
  schemaCount: number;
  tableCount: number;
  columns: number;
  rows: number;
  isActive: boolean;
  onGenerateSQL: (prompt: string, currentSQL: string) => Promise<string>;
  onExecuteSQL: (sql: string) => Promise<SQLResult[]>;
};

const fitText = (text: string, width: number) => {
  let result = '';
  let used = 0;
  for (const character of text) {
    used += Bun.stringWidth(character);
    if (used > width) break;
    result += character;
  }
  return result;
};

export const formatResults = (results: SQLResult[]) =>
  results
    .map((result) => {
      const summary =
        result.count === null
          ? `${result.command} · completed`
          : `${result.command} · ${result.count} ${result.columns.length ? 'rows returned' : 'rows affected'}`;
      if (!result.rows.length) return summary;
      const table = createTable({ head: result.columns });
      for (const row of result.rows.slice(0, 100)) {
        table.push(
          result.columns.map((column) => {
            const value = row[column];
            return value == null ? 'NULL' : typeof value === 'object' ? JSON.stringify(value) : String(value);
          })
        );
      }
      return `${summary}\nShowing ${Math.min(100, result.rows.length)} of ${result.rows.length} rows\n\n${table.toString()}`;
    })
    .join('\n\n');

export const SQLView = ({
  target,
  schemaCount,
  tableCount,
  columns,
  rows,
  isActive,
  onGenerateSQL,
  onExecuteSQL
}: SQLViewProps) => {
  const [input, setInput] = useState('');
  const [cursor, setCursor] = useState(0);
  const [sql, setSQL] = useState('');
  const [results, setResults] = useState('');
  const [phase, setPhase] = useState<'editing' | 'editing-sql' | 'generating' | 'confirming' | 'executing'>('editing');
  const [tab, setTab] = useState<'sql' | 'results'>('sql');
  const [offset, setOffset] = useState(0);
  const [horizontal, setHorizontal] = useState(0);
  const [error, setError] = useState<{ kind: 'generation' | 'execution'; message: string }>();
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const generate = async () => {
    if (busy.current || !input.trim()) return;
    busy.current = true;
    setPhase('generating');
    setError(undefined);
    try {
      const nextSQL = await onGenerateSQL(input.trim(), sql);
      if (!mounted.current) return;
      if (!nextSQL.trim()) throw new Error('No SQL generated. Try a different description.');
      setSQL(nextSQL);
      setResults('');
      setInput('');
      setCursor(0);
      setTab('sql');
      setOffset(0);
      setHorizontal(0);
      setPhase('confirming');
    } catch (cause) {
      if (mounted.current) {
        setError({ kind: 'generation', message: `Generation failed: ${getErrorMessage(cause)}` });
        setPhase('editing');
      }
    } finally {
      busy.current = false;
    }
  };

  const execute = async () => {
    if (busy.current) return;
    busy.current = true;
    setPhase('executing');
    setError(undefined);
    try {
      const nextResults = await onExecuteSQL(sql);
      if (!mounted.current) return;
      setResults(formatResults(nextResults));
      setTab('results');
      setOffset(0);
      setHorizontal(0);
    } catch (cause) {
      if (mounted.current) setError({ kind: 'execution', message: `Execution failed: ${getErrorMessage(cause)}` });
    } finally {
      busy.current = false;
      if (mounted.current) setPhase('editing');
    }
  };

  const lines = (tab === 'sql' ? sql : results).split('\n');
  const tooSmall = columns < 60 || rows < 20;
  const targetExtraLines = Math.max(0, Math.ceil(target.length / Math.max(1, columns - 6)) - 1);
  const height = Math.max(1, rows - (phase === 'confirming' ? 18 + targetExtraLines : 14));
  const top = Math.min(offset, Math.max(0, lines.length - height));
  const width = Math.max(1, columns - 8);
  const inputChars = Array.from(input);
  let inputStart = Math.max(0, cursor - width + 4);
  while (inputStart < cursor && Bun.stringWidth(inputChars.slice(inputStart, cursor).join('')) > width - 4)
    inputStart++;

  useInput(
    (value, key) => {
      if (!busy.current && sql && (phase === 'editing' || phase === 'confirming')) {
        if (key.ctrl && value === 'e') {
          setPhase('editing-sql');
          return;
        }
        if (key.ctrl && value === 'r') {
          setTab('sql');
          setOffset(0);
          setHorizontal(0);
          setError(undefined);
          setPhase('confirming');
          return;
        }
      }
      if (key.tab && phase !== 'confirming') {
        setTab(tab === 'sql' ? 'results' : 'sql');
        setOffset(0);
        setHorizontal(0);
        return;
      }
      if (key.upArrow || key.downArrow || key.pageUp || key.pageDown) {
        const delta = key.upArrow ? -1 : key.downArrow ? 1 : key.pageUp ? -height : height;
        setOffset(Math.max(0, Math.min(lines.length - height, top + delta)));
        return;
      }
      if (key.leftArrow && (key.shift || phase === 'confirming')) {
        setHorizontal(Math.max(0, horizontal - 10));
        return;
      }
      if (key.rightArrow && (key.shift || phase === 'confirming')) {
        const lastColumn = Math.max(
          0,
          ...lines.map((line) => (Bun.stringWidth(line) > width ? Array.from(line).length - 1 : 0))
        );
        setHorizontal(Math.min(lastColumn, horizontal + 10));
        return;
      }
      if (phase !== 'editing') return;
      if (key.return) {
        void generate();
        return;
      }
      if (key.leftArrow) {
        setCursor(Math.max(0, cursor - 1));
        return;
      }
      if (key.rightArrow) {
        setCursor(Math.min(inputChars.length, cursor + 1));
        return;
      }
      if (key.ctrl && value === 'u') {
        setInput('');
        setCursor(0);
        return;
      }
      if (key.backspace || key.delete) {
        setInput([...inputChars.slice(0, Math.max(0, cursor - 1)), ...inputChars.slice(cursor)].join(''));
        setCursor(Math.max(0, cursor - 1));
        return;
      }
      if (key.ctrl || key.meta || key.escape) return;
      const text = value.replace(/[\r\n\t]/g, ' ').replace(/\p{Cc}/gu, '');
      setInput([...inputChars.slice(0, cursor), text, ...inputChars.slice(cursor)].join(''));
      setCursor(cursor + Array.from(text).length);
    },
    { isActive: isActive && !tooSmall && phase !== 'editing-sql' }
  );

  if (tooSmall) return <Text color="yellow">Resize terminal to at least 60 × 20. Ctrl+C to quit.</Text>;

  return (
    <Box flexDirection="column" paddingX={1} width={columns}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column">
        <Text bold color="cyan">
          xata ai <Text color="white"> SQL workspace</Text>
        </Text>
        <Text wrap="truncate-end">{target}</Text>
        <Text color="gray" wrap="truncate-end">
          {schemaCount} schemas · {tableCount} tables · review before running
        </Text>
      </Box>
      {phase === 'editing-sql' ? (
        <SQLEditor
          sql={sql}
          columns={columns - 2}
          rows={rows - 7}
          isActive={isActive}
          onCancel={() => setPhase('editing')}
          onSave={(editedSQL) => {
            setSQL(editedSQL);
            setResults('');
            setTab('sql');
            setOffset(0);
            setHorizontal(0);
            setError(undefined);
            setPhase('confirming');
          }}
        />
      ) : (
        <>
          <Text color="gray" wrap="truncate-end">
            {' '}
            <Text bold color={tab === 'sql' ? 'cyan' : 'gray'}>
              SQL
            </Text>{' '}
            <Text bold color={tab === 'results' ? 'cyan' : 'gray'}>
              Results
            </Text>{' '}
            · tab to switch · ↑↓ scroll · shift+←→ pan
          </Text>
          <Box
            borderStyle="round"
            borderColor="gray"
            paddingX={1}
            flexDirection="column"
            height={height + 2}
            overflow="hidden"
          >
            {sql || results ? (
              <Text>
                {lines
                  .slice(top, top + height)
                  .map((line) => fitText(Array.from(line).slice(horizontal).join(''), width))
                  .join('\n')}
              </Text>
            ) : (
              <>
                <Text bold>Ask your database a question.</Text>
                <Text color="gray">Describe what you need. AI uses your schema to draft SQL.</Text>
                <Text color="gray">Try: Show the 10 most recent orders</Text>
              </>
            )}
          </Box>
          <Text color="gray">
            {' '}
            {tab === 'sql' ? 'SQL' : 'Results'} · lines {top + 1}–{Math.min(lines.length, top + height)} of{' '}
            {lines.length} · column {horizontal + 1}
          </Text>
          {phase === 'confirming' ? (
            <ConfirmModal
              title="Execute this SQL?"
              lines={[target]}
              warning="SQL can modify or delete data. Review all lines; ←→ pans."
              isActive={isActive}
              onConfirm={() => {
                void execute();
              }}
              onCancel={() => setPhase('editing')}
            />
          ) : (
            <Box borderStyle="round" borderColor={phase === 'editing' ? 'cyan' : 'yellow'} paddingX={1}>
              {phase === 'editing' ? (
                <Text wrap="truncate-end">
                  <Text color="cyan">› </Text>
                  {inputChars.slice(inputStart, cursor).join('')}
                  <Text inverse>{inputChars[cursor] ?? ' '}</Text>
                  {inputChars.slice(cursor + 1, inputStart + width - 2).join('')}
                </Text>
              ) : (
                <Text color="yellow">{phase === 'generating' ? 'Generating SQL…' : 'Executing SQL…'}</Text>
              )}
            </Box>
          )}
          {error ? (
            <Text color="red" wrap="truncate-end">
              {error.message}
            </Text>
          ) : null}
          <Text color="gray" wrap="truncate-end">
            {' '}
            {error?.kind === 'execution'
              ? 'ctrl+r retry · ctrl+e edit SQL · enter new prompt'
              : phase === 'editing'
                ? sql
                  ? 'enter generate · ctrl+e edit SQL · ctrl+r run'
                  : 'enter generate · ctrl+u clear'
                : phase === 'confirming'
                  ? 'ctrl+e edit SQL · execution requires approval'
                  : 'Execution always requires your approval'}{' '}
            · ctrl+c quit
          </Text>
        </>
      )}
    </Box>
  );
};
