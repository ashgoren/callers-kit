// The cues grid: a beat-by-beat reference for calling a dance:
// four 8-count phrases (A1/A2/B1/B2, each two rows of four beats),
// with a short intro before them. `cells` is keyed by "section:row:col".
export interface CuesData {
  cells: Record<string, string> // HTML, same shape as figures' compact rich text
  separators?: string[] // cell keys after which a grouping divider shows
  notes?: string // freeform rich-text notes, shown alongside the grid
}

export interface CueSection {
  id: string
  label: string
  rows: 1 | 2
}

export const SECTIONS: CueSection[] = [
  { id: 'intro', label: '', rows: 1 },
  { id: 'A1', label: 'A1', rows: 2 },
  { id: 'A2', label: 'A2', rows: 2 },
  { id: 'B1', label: 'B1', rows: 2 },
  { id: 'B2', label: 'B2', rows: 2 },
]

export const COLS = 8
export const INTRO_COLS = 4

export function cellKey(section: string, row: number, col: number): string {
  return `${section}:${row}:${col}`
}

// Pixel dimensions the grid renders at before any responsive scale-down -
// CuesGrid.tsx measures its container and scales the whole table via a CSS
// transform to fit, so these need to match its actual rendered size exactly.
export const LABEL_WIDTH = 36
export const COL_WIDTH = 60
export const CELL_HEIGHT = 70
export const GRID_NATURAL_WIDTH = LABEL_WIDTH + COLS * COL_WIDTH
export const GRID_NATURAL_HEIGHT =
  SECTIONS.reduce((sum, section) => sum + section.rows, 0) * CELL_HEIGHT +
  SECTIONS.filter((section) => section.rows > 1).length
