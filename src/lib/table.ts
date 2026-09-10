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

// A single record laid out as one field per line. A one-row table has to widen for every
// field it carries, which stops fitting a terminal well before a branch runs out of fields,
// and any value containing a space breaks column alignment for whoever is parsing it.
export function renderDetails(fields: [field: string, value: string][], options: TableOptions = {}) {
  const table = createTable(options);

  fields.forEach(([field, value]) => {
    // The field name is deliberately left undecorated. It is the key someone looks a value
    // up by, and colouring it puts escape codes in front of it whenever colour is forced,
    // which is exactly when the output is being read by something else.
    table.push([field, value]);
  });

  // cli-table3 pads every cell to the column width, which leaves trailing spaces on each
  // line. They are invisible but survive into anything reading the output.
  return table
    .toString()
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
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
