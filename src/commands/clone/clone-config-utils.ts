import invariant from 'tiny-invariant';
import { parse } from 'yaml';
import type { LocalContext } from '~/context';
import { DEFAULT_CLONE_RULES_FILE } from '~/lib/constants';
import { getDynamicPIIFunctions } from './utils';

export interface CloneConfigJson {
  transformations: Transformations;
}

export interface Transformations {
  validation_mode: string;
  table_transformers?: TableTransformer[];
}

export interface TableTransformer {
  schema: string;
  table: string;
  column_transformers: Record<string, ColumnTransformers | null>;
}

export interface ColumnTransformers {
  name: string;
}

export const EMPTY_CLONE_CONFIG_JSON = {
  transformations: {
    validation_mode: 'relaxed',
    table_transformers: []
  }
};

export function readConfigFile(context: LocalContext): CloneConfigJson {
  const cloneConfig = context.fs.readFileSync(DEFAULT_CLONE_RULES_FILE, 'utf-8');
  const cloneConfigJson = parse(cloneConfig);
  return cloneConfigJson;
}

export function writeConfigFile(context: LocalContext, yamlTransformationsConfig: string) {
  context.fs.writeFileSync(DEFAULT_CLONE_RULES_FILE, yamlTransformationsConfig);
  context.process.stdout.write(`Successfully wrote config to ${DEFAULT_CLONE_RULES_FILE}`);
}

export function doesPublicSchemaExist(schemas: { schema: string }[]) {
  return schemas.some((schema) => schema.schema === 'public');
}

export function getExistingSchemas(cloneConfigJson: CloneConfigJson) {
  const existingSchemas = cloneConfigJson.transformations.table_transformers?.map(
    (tableTransformer) => tableTransformer.schema
  );
  if (!existingSchemas) {
    return [];
  }
  return existingSchemas;
}

export function getPreSelectedSchemas(cloneConfigJson: CloneConfigJson, allSchemas: { schema: string }[]) {
  const existingSchemas = getExistingSchemas(cloneConfigJson);
  const preSelectedSchemas =
    existingSchemas.length > 0 ? existingSchemas : doesPublicSchemaExist(allSchemas) ? ['public'] : [];
  return preSelectedSchemas;
}

export function getExistingTables(cloneConfigJson: CloneConfigJson) {
  // Note: get tables in the format schema.table from the existing config for any table that has at least one column transformer that is not 'noop' or null
  const existingTables = cloneConfigJson.transformations.table_transformers
    ?.filter((tableTransformer) => {
      return Object.keys(tableTransformer.column_transformers).some((column) => {
        const columnTransformer = tableTransformer.column_transformers[column];
        if (!columnTransformer) {
          return false;
        }
        return columnTransformer.name !== 'noop';
      });
    })
    .map((tableTransformer) => `${tableTransformer.schema}.${tableTransformer.table}`);
  if (!existingTables) {
    return [];
  }
  return existingTables;
}

export function getPreSelectedTables(cloneConfigJson: CloneConfigJson) {
  const existingTables = getExistingTables(cloneConfigJson);
  const preSelectedTables = existingTables.length > 0 ? existingTables : [];
  return preSelectedTables;
}

export function getExistingTable(cloneConfigJson: CloneConfigJson, selectedTable: string) {
  const existingTable = cloneConfigJson.transformations.table_transformers?.find((tableTransformer) => {
    const selectedTableTokens = selectedTable.split('.');
    invariant(selectedTableTokens.length === 2, `Invalid table name: ${selectedTable}`);
    const selectedTableSchema = selectedTableTokens[0];
    const selectedTableName = selectedTableTokens[1];
    return tableTransformer.schema === selectedTableSchema && tableTransformer.table === selectedTableName;
  });
  if (!existingTable) {
    return null;
  }
  return existingTable;
}

// Note: if a column exists in the existing config, this function will return and object with
// { <schema>.<table>.<column>: true } for each column that has a transformer that is not 'noop' or null
export function getPreSelectedColumns(cloneConfigJson: CloneConfigJson, selectedTable: string) {
  const existingTable = getExistingTable(cloneConfigJson, selectedTable);
  let preSelectedColumns: Record<string, boolean> = {};
  if (existingTable) {
    preSelectedColumns = Object.keys(existingTable.column_transformers).reduce(
      (acc, columnName) => {
        const columnTransformer = existingTable.column_transformers[columnName];
        const column = `${existingTable.schema}.${existingTable.table}.${columnName}`;
        if (!columnTransformer || columnTransformer.name === 'noop') {
          acc[column] = false;
        } else {
          acc[column] = true;
        }
        return acc;
      },
      {} as Record<string, boolean>
    );
  }
  return preSelectedColumns;
}

// Note: tableColumns string array has have the format schema.table.column
export async function getInitialColumns(
  preSelectedColumns: Record<string, boolean>,
  tableColumns: {
    schema: string;
    table: string;
    column: string;
  }[]
) {
  const { isColumnPII } = await getDynamicPIIFunctions();

  const columnsFromConfig = tableColumns
    .filter((tableColumn) => preSelectedColumns[`${tableColumn.schema}.${tableColumn.table}.${tableColumn.column}`])
    .map((tableColumn) => `${tableColumn.schema}.${tableColumn.table}.${tableColumn.column}`);

  const columnsFromHeuristics = tableColumns
    .filter(isColumnPII)
    .map((tableColumn) => `${tableColumn.schema}.${tableColumn.table}.${tableColumn.column}`);

  const columnsFromConfigToRemove = Object.keys(preSelectedColumns).filter((column) => !preSelectedColumns[column]);

  return Array.from(
    new Set(
      columnsFromHeuristics.concat(columnsFromConfig).filter((column) => !columnsFromConfigToRemove.includes(column))
    )
  );
}

/**
 * Deep-sorts all object keys in a JSON-like value.
 * Arrays preserve their element order, but objects within arrays have their keys sorted.
 */
function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(obj)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => [key, sortJsonValue(v)])
    );
  }

  return value;
}

type SortableTableTransformer = {
  schema: string;
  table: string;
  column_transformers: Record<string, unknown>;
};

type SortableCloneConfig = {
  transformations: {
    validation_mode: string;
    table_transformers?: SortableTableTransformer[];
  };
};

function sortTableTransformer<T extends SortableTableTransformer>(tt: T): T {
  const sortedColumnTransformers = Object.fromEntries(
    Object.entries(tt.column_transformers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, transformer]) => [name, sortJsonValue(transformer)])
  );

  return {
    ...tt,
    column_transformers: sortedColumnTransformers
  };
}

/**
 * Sorts a CloneConfigJson object for consistent YAML output across all modes.
 *
 * Sorting guarantees:
 * - `transformations.table_transformers` sorted by {schema, table}
 * - `column_transformers` keys sorted alphabetically
 * - All nested objects have alphabetically sorted keys
 *
 * Array element order is preserved except for table_transformers.
 */
export function sortCloneConfigForOutput<T extends SortableCloneConfig>(config: T): T {
  const tableTransformers = config.transformations.table_transformers ?? [];

  const sortedTableTransformers = [...tableTransformers].map(sortTableTransformer).sort((a, b) => {
    const schemaCmp = a.schema.localeCompare(b.schema);
    if (schemaCmp !== 0) return schemaCmp;
    return a.table.localeCompare(b.table);
  });

  const sortedTransformations = sortJsonValue({
    ...config.transformations,
    table_transformers: sortedTableTransformers
  }) as T['transformations'];

  return sortJsonValue({
    ...config,
    transformations: sortedTransformations
  }) as T;
}
