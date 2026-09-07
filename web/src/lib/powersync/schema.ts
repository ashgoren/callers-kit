import { column, Schema, Table } from '@powersync/web'

const dances = new Table({
  // 'id' is created automatically by PowerSync - do not declare it here
  created_at: column.text, // ISO 8601
  updated_at: column.text, // ISO 8601
  title: column.text,
  difficulty: column.integer,
  dance_type: column.text, // enum (e.g. 'Contra')
  formation: column.text, // enum (e.g. 'Duple Minor - Improper)
  progression: column.text, // enum (e.g. 'Single')
  notes: column.text,
})

const choreographers = new Table({
  name: column.text,
})

const dances_choreographers = new Table({
  dance_id: column.text,
  choreographer_id: column.text,
})

export const AppSchema = new Schema({ dances, choreographers, dances_choreographers })

export type Database = (typeof AppSchema)['types']
export type Dance = Database['dances']
export type Choreographer = Database['choreographers']
