import chalk from 'chalk';
import Table from 'cli-table3';

export type TableOptions = NonNullable<ConstructorParameters<typeof Table>[0]>;

const defaultTableOptions = {
  chars: {
    top: '',
    'top-mid': '',
    'top-left': '',
    'top-right': '',
    bottom: '',
    'bottom-mid': '',
    'bottom-left': '',
    'bottom-right': '',
    left: '',
    'left-mid': '',
    mid: '',
    'mid-mid': '',
    right: '',
    'right-mid': '',
    middle: ' '
  },
  style: {
    'padding-left': 0,
    'padding-right': 0,
    // Disable cli-table3's default ANSI colors (red head, grey border): they
    // ignore NO_COLOR and wrap padding and the column separator in escape
    // codes, which breaks piping output to tools like awk. Headers and cell
    // content are colored with chalk instead, which only emits colors on an
    // interactive TTY (and respects NO_COLOR / FORCE_COLOR).
    head: [],
    border: []
  }
} satisfies TableOptions;

export function createTable(options: TableOptions = {}) {
  return new Table({
    ...defaultTableOptions,
    ...options,
    chars: {
      ...defaultTableOptions.chars,
      ...options.chars
    },
    style: {
      ...defaultTableOptions.style,
      ...options.style
    }
  });
}

export function renderTable(headers: string[], rows: string[][], options: TableOptions = {}) {
  const table = createTable({
    ...options,
    head: headers.map((header) => chalk.red.bold(header))
  });

  rows.forEach((row) => {
    table.push(row);
  });

  return table.toString();
}
