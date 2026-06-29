import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import type { LocalContext } from '~/context';
import { renderQueryInsightDetails, renderQueryInsightsTable } from './display';
import { formatInteger } from './format';
import type { QueryInsightRow } from './types';

type TuiState = {
  mode: 'list' | 'detail';
  rows: QueryInsightRow[];
  total: number;
  offset: number;
  selectedIndex: number;
  listTop: number;
  detailTop: number;
  loading: boolean;
  status?: string;
};

type QueryInsightsListTuiOptions = {
  total: number;
  limit: number;
  offset: number;
  rows: QueryInsightRow[];
  wide: boolean;
};

type QueryInsightsPage = {
  total: number;
  offset: number;
  rows: QueryInsightRow[];
};

const ENTER_ALTERNATE_SCREEN = '\x1b[?1049h';
const LEAVE_ALTERNATE_SCREEN = '\x1b[?1049l';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const CLEAR_SCREEN = '\x1b[2J';
const CURSOR_HOME = '\x1b[H';
const CLEAR_LINE = '\x1b[2K';

export async function runQueryInsightsListTui(
  context: LocalContext,
  options: QueryInsightsListTuiOptions,
  loadPage: (offset: number) => Promise<QueryInsightsPage>
) {
  const stdin = context.process.stdin;
  const stdout = context.process.stdout;

  if (!stdin.setRawMode) {
    throw new Error('--output tui requires an interactive terminal.');
  }

  const state: TuiState = {
    mode: 'list',
    rows: options.rows,
    total: options.total,
    offset: options.offset,
    selectedIndex: 0,
    listTop: 0,
    detailTop: 0,
    loading: false
  };

  const previousRawMode = stdin.isRaw;
  const previousEncoding = stdin.readableEncoding;

  await new Promise<void>((resolve) => {
    const cleanup = () => {
      stdin.off('data', onData);
      stdout.off('resize', render);
      if (stdin.setRawMode) stdin.setRawMode(previousRawMode ?? false);
      if (previousEncoding) stdin.setEncoding(previousEncoding as BufferEncoding);
      stdout.write(`${SHOW_CURSOR}${LEAVE_ALTERNATE_SCREEN}`);
      resolve();
    };

    const render = () => {
      writeScreen(stdout, renderScreen(context, options, state), getHeight(context));
    };

    const loadPageOffset = async (nextOffset: number) => {
      if (state.loading || nextOffset === state.offset || nextOffset < 0 || nextOffset >= Math.max(1, state.total))
        return;

      state.loading = true;
      state.status = `Loading rows ${formatInteger(nextOffset + 1)}-${formatInteger(nextOffset + options.limit)}…`;
      render();
      try {
        const page = await loadPage(nextOffset);
        state.rows = page.rows;
        state.total = page.total;
        state.offset = page.offset;
        state.selectedIndex = 0;
        state.listTop = 0;
        state.detailTop = 0;
        state.status = undefined;
      } catch (error) {
        state.status = chalk.yellow(`Failed to load page: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        state.loading = false;
        render();
      }
    };

    const onData = (key: Buffer | string) => {
      void handleKey(key, context, options, state, render, cleanup, loadPageOffset);
    };

    stdout.write(`${ENTER_ALTERNATE_SCREEN}${HIDE_CURSOR}${CLEAR_SCREEN}`);
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
    stdout.on('resize', render);
    render();
  });
}

async function handleKey(
  key: Buffer | string,
  context: LocalContext,
  options: QueryInsightsListTuiOptions,
  state: TuiState,
  render: () => void,
  cleanup: () => void,
  loadPageOffset: (offset: number) => Promise<void>
) {
  const value = key.toString('utf8');
  if (value === '\u0003') {
    cleanup();
    return;
  }

  if (state.mode === 'list') {
    if (state.loading) return;
    if (value === '\u001b') {
      cleanup();
      return;
    }
    if (value === '\r' || value === '\n') {
      if (state.rows.length > 0) {
        state.mode = 'detail';
        state.detailTop = 0;
        render();
      }
      return;
    }
    if (value === '\x1b[A') {
      state.selectedIndex = Math.max(0, state.selectedIndex - 1);
      ensureSelectedVisible(context, state, state.rows.length);
      render();
      return;
    }
    if (value === '\x1b[B') {
      state.selectedIndex = Math.min(Math.max(0, state.rows.length - 1), state.selectedIndex + 1);
      ensureSelectedVisible(context, state, state.rows.length);
      render();
      return;
    }
    if (value === '\x1b[6~') {
      await loadPageOffset(state.offset + options.limit);
      return;
    }
    if (value === '\x1b[5~') {
      await loadPageOffset(Math.max(0, state.offset - options.limit));
    }
    return;
  }

  if (value === '\u001b') {
    state.mode = 'list';
    render();
    return;
  }
  if (value === '\x1b[A') {
    state.detailTop = Math.max(0, state.detailTop - 1);
    render();
    return;
  }
  if (value === '\x1b[B') {
    state.detailTop += 1;
    render();
    return;
  }
  if (value === '\x1b[5~') {
    state.detailTop = Math.max(0, state.detailTop - Math.max(1, getHeight(context) - 4));
    render();
    return;
  }
  if (value === '\x1b[6~') {
    state.detailTop += Math.max(1, getHeight(context) - 4);
    render();
    return;
  }
}

function renderScreen(context: LocalContext, options: QueryInsightsListTuiOptions, state: TuiState) {
  const height = getHeight(context);
  const width = getWidth(context);
  const lines =
    state.mode === 'detail'
      ? renderDetailScreen(state.rows, state, { height, width })
      : renderListScreen(context, options, state);
  return lines.slice(0, height).map((line) => truncateVisible(line, width));
}

function renderListScreen(context: LocalContext, options: QueryInsightsListTuiOptions, state: TuiState) {
  const height = getHeight(context);
  const visibleRows = Math.max(0, height - 7);
  const rowsForPage = state.rows.slice(state.listTop, state.listTop + visibleRows);
  const selectedIndex = state.selectedIndex - state.listTop;
  const start = state.rows.length === 0 ? 0 : state.offset + 1;
  const end = state.offset + state.rows.length;
  const previousHint = state.offset > 0 ? 'PgUp previous page' : chalk.dim('PgUp previous page');
  const nextHint = end < state.total ? 'PgDn next page' : chalk.dim('PgDn next page');
  const lines = [
    chalk.bold.cyan('Xata query insights'),
    chalk.dim(`Showing ${formatInteger(start)}-${formatInteger(end)} of ${formatInteger(state.total)} queries`),
    ''
  ];

  if (state.rows.length === 0) {
    lines.push('No query insights matched the current filters.');
    return lines;
  }

  lines.push(
    ...renderQueryInsightsTable(context, rowsForPage, {
      wide: options.wide,
      includeSelector: true,
      queryFocused: !options.wide,
      selectedIndex
    }).split('\n')
  );
  lines.push('');
  if (state.status) lines.push(state.status);
  lines.push(chalk.dim(`↑/↓ move • Enter details • ${previousHint} • ${nextHint} • Esc quit`));
  return lines;
}

function renderDetailScreen(rows: QueryInsightRow[], state: TuiState, size: { height: number; width: number }) {
  const row = rows[state.selectedIndex];
  const shortcuts = chalk.dim('↑/↓ scroll • PgUp/PgDn scroll faster • Esc back to list');
  if (!row) return ['No query selected.', '', shortcuts];

  const detailLines = renderQueryInsightDetails(row)
    .split('\n')
    .flatMap((line) => wrapLine(line, size.width));
  const header = [chalk.bold.cyan(`Query insight ${row.queryid} — db=${row.database} role=${row.user}`), ''];
  const footer = ['', shortcuts];
  const visibleDetailLineCount = Math.max(0, size.height - header.length - footer.length);
  return [...header, ...detailLines.slice(state.detailTop, state.detailTop + visibleDetailLineCount), ...footer];
}

function ensureSelectedVisible(context: LocalContext, state: TuiState, rowsLength: number) {
  const visibleRows = Math.max(1, getHeight(context) - 7);
  if (rowsLength === 0) {
    state.listTop = 0;
    return;
  }
  if (state.selectedIndex < state.listTop) {
    state.listTop = state.selectedIndex;
  } else if (state.selectedIndex >= state.listTop + visibleRows) {
    state.listTop = state.selectedIndex - visibleRows + 1;
  }
}

function getWidth(context: LocalContext) {
  return Math.max(40, context.process.stdout.columns || 120);
}

function getHeight(context: LocalContext) {
  return Math.max(12, context.process.stdout.rows || 30);
}

function writeScreen(stdout: NodeJS.WriteStream, lines: string[], height: number) {
  const paddedLines = [...lines, ...Array.from({ length: Math.max(0, height - lines.length) }, () => '')];
  stdout.write(`${CURSOR_HOME}${paddedLines.map((line) => `${CLEAR_LINE}${line}`).join('\n')}`);
}

function truncateVisible(line: string, width: number) {
  if (stripAnsi(line).length <= width) return line;
  return `${stripAnsi(line).slice(0, Math.max(0, width - 1))}…`;
}

function wrapLine(line: string, width: number) {
  const visible = stripAnsi(line);
  if (visible.length <= width) return [line];
  if (visible !== line) return [truncateVisible(line, width)];

  const lines: string[] = [];
  for (let start = 0; start < line.length; start += width) {
    lines.push(line.slice(start, start + width));
  }
  return lines;
}
