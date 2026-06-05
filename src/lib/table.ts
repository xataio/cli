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
    'padding-right': 0
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
    head: headers
  });

  rows.forEach((row) => {
    table.push(row);
  });

  return table.toString();
}
