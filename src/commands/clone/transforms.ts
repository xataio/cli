import type { Schema } from '@xata.io/sql';
import type { LocalContext } from '~/context';
import type { ValidationMode } from './config';
import { getDynamicPIIFunctions } from './utils';

export async function getTransformsConfig(
  _context: LocalContext,
  fullSchemaJson: Schema[],
  selectedColumns: string[],
  validationMode: ValidationMode
) {
  const sortedSchemas = fullSchemaJson.sort((a, b) => a.name.localeCompare(b.name));
  const { getTransformer } = await getDynamicPIIFunctions();

  const schema = sortedSchemas.flatMap((schema) => {
    const sortedTables = Object.entries(schema.tables).sort(([a], [b]) => a.localeCompare(b));

    return sortedTables.map(([tableName, table]) => {
      const sortedColumns = Object.entries(table.columns).sort(([a], [b]) => a.localeCompare(b));

      const columnTransformers = sortedColumns.reduce(
        (acc, [columnName, column]) => {
          if (validationMode === 'strict' && !selectedColumns.includes(`${schema.name}.${tableName}.${columnName}`)) {
            acc[columnName] = {
              name: 'noop'
            };
            return acc;
          }
          const transformer = getTransformer(schema, table, column);
          if (transformer) {
            acc[columnName] = transformer;
          }
          return acc;
        },
        {} as Record<string, unknown>
      );

      return {
        schema: schema.name,
        table: tableName,
        column_transformers: columnTransformers
      };
    });
  });

  return { transformations: { validation_mode: validationMode, table_transformers: schema } };
}
