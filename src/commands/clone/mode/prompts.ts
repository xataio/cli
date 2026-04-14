import type { Schema } from '@xata.io/sql';
import chalk from 'chalk';
import dedent from 'dedent';
import type { LocalContext } from '~/context';
import {
  type CloneConfigJson,
  getInitialColumns,
  getPreSelectedColumns,
  getPreSelectedSchemas,
  getPreSelectedTables
} from '../clone-config-utils';
import { getColumns, getSchemas, getTables } from '../utils';

export async function getSelectedColumnsViaPrompt(
  context: LocalContext,
  fullSchemaJson: Schema[],
  cloneConfigJson: CloneConfigJson
) {
  const shortcuts = chalk.gray(`(${chalk.bold('a')} to select all, ${chalk.bold('i')} to invert selection)`);
  context.process.stdout.write(
    dedent(`
    To configure cloning, please select the database entities you want to anonymize.
    To reduce the options, we will first ask you to pick the schemas you want to configure.

    Then we will proceed to ask you tables from the selected schemas.
    Then you will be asked to select the columns you want to anonymize.

    Finally, you will be able to configure the anonymization rules for each column.`)
  );

  const allSchemas = await getSchemas(fullSchemaJson);
  if (allSchemas.length === 0) {
    context.process.stderr.write(`Failed to find any schemas in the database.\n`);
    return [];
  }

  const preselectedSchemas = await getPreSelectedSchemas(cloneConfigJson, allSchemas);
  const selectedSchemas = await context.enquirer.multiselectPrompt(
    context.isCI,
    `Pick the schemas you want to configure ${shortcuts}`,
    allSchemas.map((schema) => ({
      name: `${schema.schema}`,
      message: `${schema.schema}`
    })),
    preselectedSchemas
  );

  const allTables = await getTables(fullSchemaJson, selectedSchemas);
  if (allTables.length === 0) {
    context.process.stderr.write(`Failed to find any tables in the selected schemas: ${selectedSchemas.join(',')}.\n`);
    return [];
  }
  const preSelectedTables = getPreSelectedTables(cloneConfigJson);

  const selectedTables = await context.enquirer.multiselectPrompt(
    context.isCI,
    `Pick the tables you want to configure ${shortcuts}`,
    allTables.map((table) => ({
      name: `${table.schema}.${table.table}`,
      message: `${table.schema}.${table.table}`
    })),
    preSelectedTables
  );

  const allColumns = await getColumns(fullSchemaJson, selectedTables);
  if (allColumns.length === 0) {
    context.process.stderr.write(`Failed to find any columns in the selected tables: ${selectedTables.join(',')}.\n`);
    return [];
  }

  const allSelectedColumns: string[] = [];
  for (const selectedTable of selectedTables) {
    const allTableColumns = allColumns.filter((column) => `${column.schema}.${column.table}` === selectedTable);

    const preSelectedColumns = getPreSelectedColumns(cloneConfigJson, selectedTable);

    const selectedColumns = await context.enquirer.multiselectPrompt(
      context.isCI,
      `Pick the columns you want to configure for the table ${selectedTable} ${shortcuts}`,
      allTableColumns.map((column) => ({
        name: `${column.schema}.${column.table}.${column.column}`,
        message: `${column.schema}.${column.table}.${column.column}`
      })),
      await getInitialColumns(preSelectedColumns, allTableColumns)
    );
    const selectedColumnsConfig = selectedColumns.reduce(
      (acc, selectedColumn) => {
        acc[selectedColumn] = true;
        return acc;
      },
      {} as Record<string, boolean>
    );
    allSelectedColumns.push(...Object.keys(selectedColumnsConfig));
  }
  return allSelectedColumns;
}
