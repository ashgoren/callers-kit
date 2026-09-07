import { column, Schema, Table } from '@powersync/web'

const dances = new Table({
  // 'id' is created automatically by PowerSync — do not declare it here
  title: column.text,
})

export const AppSchema = new Schema({ dances })

export type Database = (typeof AppSchema)['types']
export type Dance = Database['dances']
