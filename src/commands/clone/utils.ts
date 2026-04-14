import type { XataConfig } from '@xata.io/config';
import type { Schema } from '@xata.io/sql';
import { DEFAULT_CLONE_LOCAL_CONFIG_PATH } from '~/lib/constants';

import fs from 'node:fs';
import path from 'node:path';

export const getDynamicPIIFunctions = async () => {
  const localCloneConfigPath = path.join(process.cwd(), DEFAULT_CLONE_LOCAL_CONFIG_PATH);

  try {
    if (fs.existsSync(localCloneConfigPath)) {
      const { xataConfig: localXataConfig }: { xataConfig: XataConfig } = await import(localCloneConfigPath);
      return {
        getTransformer: localXataConfig.clone.getTransformer,
        isColumnPII: localXataConfig.clone.isColumnPII
      };
    }
  } catch (error) {
    console.warn('Failed to load local PII implementation, falling back to @xata.io/config');
    console.error(error);
  }

  const { xataConfig } = await import('@xata.io/config');
  return { getTransformer: xataConfig.clone.getTransformer, isColumnPII: xataConfig.clone.isColumnPII };
};

export async function getSchemas(fullSchemaJson: Schema[]) {
  const schemas = fullSchemaJson;

  const schema = schemas.flatMap((schema) => ({
    schema: schema.name
  }));
  return schema;
}

export async function getTables(fullSchemaJson: Schema[], schemas: string[]) {
  const allSchemas = fullSchemaJson;

  const schema = allSchemas
    .filter((schema) => schemas.includes(schema.name))
    .flatMap((schema) =>
      Object.entries(schema.tables).flatMap(([tableName]) => ({
        schema: schema.name,
        table: tableName
      }))
    );
  return schema;
}

// Note: tables string array has have the format schema.table
export async function getColumns(fullSchemaJson: Schema[], tables: string[]) {
  const allSchemas = fullSchemaJson;

  const schema = allSchemas.flatMap((schema) =>
    Object.entries(schema.tables)
      .filter(([tableName]) => tables.includes(`${schema.name}.${tableName}`))
      .flatMap(([tableName, table]) =>
        Object.keys(table.columns).map((columnName) => ({
          schema: schema.name,
          table: tableName,
          column: columnName
        }))
      )
  );
  return schema;
}
