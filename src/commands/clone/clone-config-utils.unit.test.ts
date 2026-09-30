import { describe, expect, it } from 'bun:test';
import dedent from 'dedent';
import { parse } from 'yaml';
import {
  type CloneConfigJson,
  EMPTY_CLONE_CONFIG_JSON,
  getExistingSchemas,
  getExistingTable,
  getExistingTables,
  getInitialColumns,
  getPreSelectedColumns,
  getPreSelectedSchemas,
  sortCloneConfigForOutput,
  stringifyCloneConfig
} from './clone-config-utils';

it('preserves pgstream string dates, float bounds and integer parameters in YAML', () => {
  const config = {
    transformations: {
      validation_mode: 'strict',
      table_transformers: [
        {
          schema: 'public',
          table: 'employees',
          column_transformers: {
            salary: { name: 'greenmask_float', parameters: { min_value: -30000, max_value: 150000 } },
            age: { name: 'greenmask_integer', parameters: { min_value: 18, max_value: 99 } },
            created_at: { name: 'greenmask_utc_timestamp', parameters: { min_timestamp: '2020-01-01T00:00:00Z' } },
            hire_date: { name: 'greenmask_date', parameters: { min_value: '2000-01-01' } }
          }
        }
      ]
    }
  };
  const yaml = stringifyCloneConfig(config);
  expect(yaml).toContain('min_value: -30000.0');
  expect(yaml).toContain('max_value: 150000.0');
  expect(yaml).toContain('min_value: 18\n');
  expect(parse(yaml, { version: '1.1' })).toEqual(config);
});

const baseCloneConfig = dedent(`
    transformations:
      validation_mode: strict
      table_transformers:
      - schema: public
        table: User
        column_transformers:
          id:
            name: noop
    `);

const baseCloneConfigWithNonNoopTransformers = dedent(`
    transformations:
      validation_mode: strict
      table_transformers:
      - schema: public
        table: User
        column_transformers:
          id:
            name: noop
          name:
            name: masking
            parameters:
              type: default
          email:
            name: masking
            parameters:
              type: default
          phone:
            name: noop
          publicKey:
            name: noop
    `);

const tableColumns = [
  {
    schema: 'public',
    table: 'User',
    column: 'id'
  },
  {
    schema: 'public',
    table: 'User',
    column: 'name'
  },
  {
    schema: 'public',
    table: 'User',
    column: 'email'
  },
  {
    schema: 'public',
    table: 'User',
    column: 'phone'
  },
  {
    schema: 'public',
    table: 'User',
    column: 'publicKey'
  }
];

describe('cloneConfigUtils tests', () => {
  it('getExistingSchemas should return any mentioned schemas from clone config file', () => {
    expect(getExistingSchemas(parse(baseCloneConfig))).toEqual(['public']);
  });

  it('getExistingSchemas should return empty if there are no transformers, array syntax', () => {
    const config = dedent(`
    transformations:
      validation_mode: strict
      table_transformers: []
    `);
    expect(getExistingSchemas(parse(config))).toEqual([]);
  });

  it('getExistingSchemas should return empty if there are no transformers', () => {
    const config = dedent(`
    transformations:
      validation_mode: strict
      table_transformers:
    `);
    expect(getExistingSchemas(parse(config))).toEqual([]);
  });

  it('getPreSelectedSchemas should return any existing schemas from clone config file', () => {
    expect(
      getPreSelectedSchemas(parse(baseCloneConfig), [
        {
          schema: 'public'
        }
      ])
    ).toEqual(['public']);
  });

  it('getPreSelectedSchemas should return public is existing schemas is empty and public exists', () => {
    expect(
      getPreSelectedSchemas(EMPTY_CLONE_CONFIG_JSON, [
        {
          schema: 'public'
        }
      ])
    ).toEqual(['public']);
  });

  it('getPreSelectedSchemas should return empty if the existing schemas is empty and public does not exists', () => {
    expect(
      getPreSelectedSchemas(EMPTY_CLONE_CONFIG_JSON, [
        {
          schema: 'schema1'
        }
      ])
    ).toEqual([]);
  });

  it('getExistingTables should return empty when no table in config has non noop transformers', () => {
    expect(getExistingTables(parse(baseCloneConfig))).toEqual([]);
  });

  it('getExistingTables should return any existing table i.e. table with at least one non noop column', () => {
    expect(getExistingTables(parse(baseCloneConfigWithNonNoopTransformers))).toEqual(['public.User']);
  });

  it('getExistingTable should return the table, if it exists in the config', () => {
    expect(getExistingTable(parse(baseCloneConfig), 'public.User')).toEqual({
      schema: 'public',
      table: 'User',
      column_transformers: {
        id: { name: 'noop' }
      }
    });
  });

  it('getExistingTable should return null, if it selected table is not in the config', () => {
    expect(getExistingTable(parse(baseCloneConfig), 'public.NewTable')).toEqual(null);
  });

  it('getPreSelectedColumns should return object with true for columns that are not noop', () => {
    expect(getPreSelectedColumns(parse(baseCloneConfigWithNonNoopTransformers), 'public.User')).toEqual({
      'public.User.id': false,
      'public.User.name': true,
      'public.User.email': true,
      'public.User.phone': false,
      'public.User.publicKey': false
    });
  });

  it('getPreSelectedColumns should return an empty object if the selected table has no columns that are not noop', () => {
    expect(getPreSelectedColumns(parse(baseCloneConfig), 'public.User')).toEqual({
      'public.User.id': false
    });
  });

  it('getPreSelectedColumns should return an empty object if the selected table has is not in config', () => {
    expect(getPreSelectedColumns(parse(baseCloneConfig), 'public.NewTable')).toEqual({});
  });

  it('getInitialColumns should return default columns if the base config does not exist', async () => {
    expect(await getInitialColumns({}, tableColumns)).toEqual([
      'public.User.id',
      'public.User.name',
      'public.User.email',
      'public.User.phone'
    ]);
  });

  it('getInitialColumns should return default columns if the base config does not have any non noop columns', async () => {
    const preSelectedColumns = getPreSelectedColumns(parse(baseCloneConfig), 'public.User');
    expect(await getInitialColumns(preSelectedColumns, tableColumns)).toEqual([
      'public.User.name',
      'public.User.email',
      'public.User.phone'
    ]);
  });

  it('getInitialColumns should return default columns and non noop columns from config', async () => {
    const preSelectedColumns = getPreSelectedColumns(parse(baseCloneConfigWithNonNoopTransformers), 'public.User');
    expect(await getInitialColumns(preSelectedColumns, tableColumns)).toEqual([
      'public.User.name',
      'public.User.email'
    ]);
  });
});

describe('sortCloneConfigForOutput', () => {
  it('should sort table_transformers by schema then table', () => {
    const config: CloneConfigJson = {
      transformations: {
        validation_mode: 'strict',
        table_transformers: [
          { schema: 'public', table: 'zebra', column_transformers: {} },
          { schema: 'analytics', table: 'events', column_transformers: {} },
          { schema: 'public', table: 'apple', column_transformers: {} }
        ]
      }
    };

    const sorted = sortCloneConfigForOutput(config);

    expect(sorted.transformations.table_transformers?.map((t) => `${t.schema}.${t.table}`)).toEqual([
      'analytics.events',
      'public.apple',
      'public.zebra'
    ]);
  });

  it('should sort column_transformers keys alphabetically', () => {
    const config = {
      transformations: {
        validation_mode: 'strict' as const,
        table_transformers: [
          {
            schema: 'public',
            table: 'users',
            column_transformers: {
              zip_code: { name: 'noop' },
              email: { name: 'masking' },
              address: { name: 'noop' }
            }
          }
        ]
      }
    };

    const sorted = sortCloneConfigForOutput(config);
    const sortedTables = sorted.transformations.table_transformers ?? [];
    const columnKeys = Object.keys(sortedTables[0]!.column_transformers);

    expect(columnKeys).toEqual(['address', 'email', 'zip_code']);
  });

  it('should sort nested object keys in column transformers', () => {
    const config = {
      transformations: {
        validation_mode: 'strict' as const,
        table_transformers: [
          {
            schema: 'public',
            table: 'users',
            column_transformers: {
              email: {
                name: 'masking',
                parameters: {
                  zeta: 'value1',
                  alpha: 'value2'
                }
              }
            }
          }
        ]
      }
    };

    const sorted = sortCloneConfigForOutput(config);
    const sortedTables = sorted.transformations.table_transformers ?? [];
    const transformer = sortedTables[0]!.column_transformers.email as Record<string, unknown>;
    const parameterKeys = Object.keys(transformer.parameters as Record<string, unknown>);

    expect(parameterKeys).toEqual(['alpha', 'zeta']);
  });

  it('should not mutate the original config', () => {
    const config = {
      transformations: {
        validation_mode: 'strict' as const,
        table_transformers: [
          { schema: 'public', table: 'zebra', column_transformers: {} },
          { schema: 'public', table: 'apple', column_transformers: {} }
        ]
      }
    };

    const originalFirstTable = (config.transformations.table_transformers ?? [])[0]!.table;
    sortCloneConfigForOutput(config);

    expect((config.transformations.table_transformers ?? [])[0]!.table).toEqual(originalFirstTable);
  });

  it('should handle empty table_transformers', () => {
    const config: CloneConfigJson = {
      transformations: {
        validation_mode: 'relaxed',
        table_transformers: []
      }
    };

    const sorted = sortCloneConfigForOutput(config);

    expect(sorted.transformations.table_transformers).toEqual([]);
  });

  it('should handle undefined table_transformers', () => {
    const config: CloneConfigJson = {
      transformations: {
        validation_mode: 'relaxed'
      }
    };

    const sorted = sortCloneConfigForOutput(config);

    expect(sorted.transformations.table_transformers).toEqual([]);
  });
});
