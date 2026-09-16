import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commitVersionNotes } from './commitVersionNotes'
import { db } from '@/lib/powersync/database' // Actually loads the mock below, not the real module.
import type { DanceVersion } from '@/lib/figures'

vi.mock('@/lib/powersync/database', () => ({
  db: { execute: vi.fn() },
}))

function makeVersions(): DanceVersion[] {
  return [
    { id: 'v1', label: 'Choreography', figures: [], notes: '<p>Old notes.</p>' },
    { id: 'v2', label: 'Calling', figures: [], notes: null },
  ]
}

describe('commitVersionNotes', () => {
  beforeEach(() => {
    vi.mocked(db.execute).mockClear()
  })

  it('updates only the targeted version\'s notes, writing the whole versions array back', async () => {
    await commitVersionNotes('42', makeVersions(), 'v1', '<p>New notes.</p>')

    expect(db.execute).toHaveBeenCalledWith('UPDATE dances SET versions = ? WHERE id = ?', [
      JSON.stringify([
        { id: 'v1', label: 'Choreography', figures: [], notes: '<p>New notes.</p>' },
        { id: 'v2', label: 'Calling', figures: [], notes: null },
      ]),
      '42',
    ])
  })

  it('leaves every other version untouched, including one whose notes is already null', async () => {
    await commitVersionNotes('42', makeVersions(), 'v2', '<p>Calling notes.</p>')

    expect(db.execute).toHaveBeenCalledWith('UPDATE dances SET versions = ? WHERE id = ?', [
      JSON.stringify([
        { id: 'v1', label: 'Choreography', figures: [], notes: '<p>Old notes.</p>' },
        { id: 'v2', label: 'Calling', figures: [], notes: '<p>Calling notes.</p>' },
      ]),
      '42',
    ])
  })

  it('supports clearing a version\'s notes to null', async () => {
    await commitVersionNotes('42', makeVersions(), 'v1', null)

    expect(db.execute).toHaveBeenCalledWith('UPDATE dances SET versions = ? WHERE id = ?', [
      JSON.stringify([
        { id: 'v1', label: 'Choreography', figures: [], notes: null },
        { id: 'v2', label: 'Calling', figures: [], notes: null },
      ]),
      '42',
    ])
  })
})
