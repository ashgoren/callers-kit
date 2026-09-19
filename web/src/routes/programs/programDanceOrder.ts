import type { ProgramDance } from './ProgramsPage.columns'

// Assigns each dance its 1-based order by list position - the one place
// that decides what a program's dance lineup's order values should be
// after a reorder or removal. commitProgramDanceReorder.ts's
// reorderProgramDances/removeProgramDance just persist whatever order
// values they're given.
export function renumberSequentially(dances: ProgramDance[]): ProgramDance[] {
  return dances.map((dance, index) => ({ ...dance, order: index + 1 }))
}
