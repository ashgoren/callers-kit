import { describe, expect, it } from 'vitest'
import { AppSchema, JSON_COLUMNS } from './schema'

describe('JSON_COLUMNS', () => {
  it('names only tables and columns that actually exist in AppSchema', () => {
    // jsonColumn() registers table/column names as plain strings, with no
    // structural link back to the table/column it was called on - a typo in
    // either string would otherwise misfile the registration silently,
    // leaving the connector's upload path to skip decoding a real jsonb
    // column exactly like the bug this file guards against.
    for (const [tableName, columnNames] of Object.entries(JSON_COLUMNS)) {
      const table = AppSchema.tables.find((t) => t.name === tableName)
      expect(table, `JSON_COLUMNS names table "${tableName}", which isn't in AppSchema`).toBeDefined()

      const realColumnNames = table!.columns.map((c) => c.name)
      for (const columnName of columnNames) {
        expect(
          realColumnNames,
          `JSON_COLUMNS names column "${tableName}.${columnName}", which isn't a real column on that table`,
        ).toContain(columnName)
      }
    }
  })
})
