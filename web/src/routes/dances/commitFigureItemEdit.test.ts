import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commitFigureItemEdit } from './commitFigureItemEdit'
import { db } from '@/lib/powersync/database' // Actually loads the mock below, not the real module.
import type { FigureItem } from '@/lib/figures'

vi.mock('@/lib/powersync/database', () => ({
  db: { execute: vi.fn() },
}))

function makeFigures(): FigureItem[] {
  return [
    { id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: 'Circle left' },
    { id: 'n1', kind: 'note', text: 'Watch the timing' },
  ]
}

describe('commitFigureItemEdit', () => {
  beforeEach(() => {
    vi.mocked(db.execute).mockClear()
  })

  it('updates a figure entry\'s description, writing the whole figures array back', async () => {
    await commitFigureItemEdit('v1', makeFigures(), 'f1', 'Circle right')

    expect(db.execute).toHaveBeenCalledWith('UPDATE dance_versions SET figures = ? WHERE id = ?', [
      JSON.stringify([
        { id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: 'Circle right' },
        { id: 'n1', kind: 'note', text: 'Watch the timing' },
      ]),
      'v1',
    ])
  })

  it('updates a note entry\'s text, not its description field', async () => {
    await commitFigureItemEdit('v1', makeFigures(), 'n1', 'Slow down here')

    expect(db.execute).toHaveBeenCalledWith('UPDATE dance_versions SET figures = ? WHERE id = ?', [
      JSON.stringify([
        { id: 'f1', kind: 'figure', phrase: 'A1', beats: 8, description: 'Circle left' },
        { id: 'n1', kind: 'note', text: 'Slow down here' },
      ]),
      'v1',
    ])
  })

  it('leaves every other item untouched', async () => {
    await commitFigureItemEdit('v1', makeFigures(), 'f1', 'Circle right')

    const [, params] = vi.mocked(db.execute).mock.calls[0] as [string, unknown[]]
    const updated = JSON.parse(params[0] as string) as FigureItem[]
    expect(updated[1]).toEqual({ id: 'n1', kind: 'note', text: 'Watch the timing' })
  })
})
