import { useQuery } from '@powersync/react'
import { parseProgramRow, programSelectColumns } from './ProgramsPage.data'
import type { ProgramQueryRow } from './ProgramsPage.data'
import type { ProgramWithJoins } from './ProgramsPage.columns'

const PROGRAM_QUERY = `
  SELECT ${programSelectColumns()}
  FROM programs
  LEFT JOIN locations ON locations.id = programs.location_id
  WHERE programs.id = ?
`

export function useProgram(id: string): { program: ProgramWithJoins | null; isLoading: boolean } {
  // Reactive, same as usePrograms() - re-runs whenever this program's own
  // row, or its joined dance lineup, change.
  const { data: rows, isLoading } = useQuery<ProgramQueryRow>(PROGRAM_QUERY, [id])

  return { program: rows[0] ? parseProgramRow(rows[0]) : null, isLoading }
}
