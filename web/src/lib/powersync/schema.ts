import { column, Schema, Table } from '@powersync/web'

// PowerSync has no jsonb column type - a Postgres jsonb column is mirrored
// here as plain TEXT holding a JSON-encoded string, decoded back into a
// real object/array on read. jsonColumn() marks which text columns need
// that treatment, collected into JSON_COLUMNS as this file is evaluated so
// the sync connector's upload path (which must undo the same encoding
// before writing back to Postgres, or the column ends up double-encoded as
// a JSON string instead of an array/object) can look them up directly from
// the schema - one place to update when a jsonb column is added, not two.
export const JSON_COLUMNS: Record<string, string[]> = {}

function jsonColumn(tableName: string, columnName: string): typeof column.text {
  ;(JSON_COLUMNS[tableName] ??= []).push(columnName)
  return column.text
}

const dances = new Table({
  // 'id' is created automatically by PowerSync - do not declare it here
  created_at: column.text, // ISO 8601
  updated_at: column.text, // ISO 8601
  title: column.text,
  difficulty: column.integer,
  dance_type: column.text, // enum (e.g. 'Contra')
  formation: column.text, // enum (e.g. 'Duple Minor - Improper)
  progression: column.text, // enum (e.g. 'Single')
})

const dance_versions = new Table({
  dance_id: column.text,
  order: column.integer,
  label: column.text,
  figures: jsonColumn('dance_versions', 'figures'), // JSON-encoded FigureItem[]
  notes: column.text,
  walkthrough: column.text,
  cues: jsonColumn('dance_versions', 'cues'), // JSON-encoded {cells: Record<string, string>}
  manual_phrasing: column.integer, // SQLite has no boolean type - 0/1
  created_at: column.text, // ISO 8601
  updated_at: column.text, // ISO 8601
})

const choreographers = new Table({
  name: column.text,
})

const dances_choreographers = new Table({
  dance_id: column.text,
  choreographer_id: column.text,
})

const key_moves = new Table({
  name: column.text,
})

const vibes = new Table({
  name: column.text,
})

const dances_key_moves = new Table({
  dance_id: column.text,
  key_move_id: column.text,
})

const dances_vibes = new Table({
  dance_id: column.text,
  vibe_id: column.text,
})

const user_table_preferences = new Table({
  table_name: column.text,
  // JSON-encoded {columnVisibility, sorting, columnPinning, columnOrder, columnSizing}
  column_state: jsonColumn('user_table_preferences', 'column_state'),
})

const programs = new Table({
  created_at: column.text, // ISO 8601
  updated_at: column.text, // ISO 8601
  date: column.text, // ISO 8601 date only (no time component)
  location: column.text,
  notes: column.text,
  share_token: column.text,
})

const programs_dances = new Table({
  order: column.integer,
  dance_id: column.text,
  program_id: column.text,
})

export const AppSchema = new Schema({
  dances,
  dance_versions,
  choreographers,
  dances_choreographers,
  key_moves,
  vibes,
  dances_key_moves,
  dances_vibes,
  user_table_preferences,
  programs,
  programs_dances,
})

export type Database = (typeof AppSchema)['types']
export type Dance = Database['dances']
export type Choreographer = Database['choreographers']
export type KeyMove = Database['key_moves']
export type Vibe = Database['vibes']
export type Program = Database['programs']
