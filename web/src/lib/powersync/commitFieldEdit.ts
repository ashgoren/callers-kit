import { db } from './database'

// Single chokepoint for field-level writes to the local PowerSync database.
// `table` and `column` are trusted, hardcoded identifiers our own field
// components pass in — never raw user input — since SQL placeholders (`?`)
// only parameterize values, not table/column names, so those two have to be
// interpolated directly into the query string.
export async function commitFieldEdit(
  table: string,
  id: string,
  column: string,
  value: string | null,
): Promise<void> {
  await db.execute(`UPDATE ${table} SET ${column} = ? WHERE id = ?`, [value, id])
}
