import { column, Schema, Table } from '@powersync/web'

const dances = new Table({
  // 'id' is created automatically by PowerSync — do not declare it here
  created_at: column.text, // ISO 8601
  updated_at: column.text, // ISO 8601
  title: column.text,
  difficulty: column.integer,
  dance_type: column.text, // enum (e.g. 'Contra')
  formation: column.text, // enum (e.g. 'Duple Minor - Improper)
  progression: column.text, // enum (e.g. 'Single')
  notes: column.text,
})

export const AppSchema = new Schema({ dances })

export type Database = (typeof AppSchema)['types']
export type Dance = Database['dances']
