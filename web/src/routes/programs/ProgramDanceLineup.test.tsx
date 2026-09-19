import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { ProgramDanceLineup } from './ProgramDanceLineup'
import type { ProgramDance } from './ProgramsPage.columns'

const { useDancesMock, reorderProgramDancesMock, addProgramDanceMock, removeProgramDanceMock } = vi.hoisted(() => ({
  useDancesMock: vi.fn(),
  reorderProgramDancesMock: vi.fn(),
  addProgramDanceMock: vi.fn(),
  removeProgramDanceMock: vi.fn(),
}))

vi.mock('@/routes/dances/DancesPage.data', () => ({
  useDances: useDancesMock,
}))

vi.mock('@/lib/powersync/commitProgramDanceReorder', () => ({
  reorderProgramDances: reorderProgramDancesMock,
  addProgramDance: addProgramDanceMock,
  removeProgramDance: removeProgramDanceMock,
}))

const LINEUP: ProgramDance[] = [
  { programDanceId: 'pd-1', danceId: 'd-1', order: 1, title: 'Chorus Jig' },
  { programDanceId: 'pd-2', danceId: 'd-2', order: 2, title: 'Money Musk' },
]

// Only id/title actually get read by the "Add dance" combobox.
const ALL_DANCES = [
  { id: 'd-1', title: 'Chorus Jig' },
  { id: 'd-2', title: 'Money Musk' },
  { id: 'd-3', title: 'Petronella' },
]

function renderLineup(dances: ProgramDance[] = LINEUP) {
  return render(
    <MemoryRouter>
      <ProgramDanceLineup programId="program-1" dances={dances} />
    </MemoryRouter>,
  )
}

describe('ProgramDanceLineup', () => {
  beforeEach(() => {
    useDancesMock.mockReturnValue({ dances: ALL_DANCES, isLoading: false })
    reorderProgramDancesMock.mockReset().mockResolvedValue(undefined)
    addProgramDanceMock.mockReset().mockResolvedValue('pd-new')
    removeProgramDanceMock.mockReset().mockResolvedValue(undefined)
  })

  describe('view mode (default) - plain numbered list, nothing interactive', () => {
    it('renders each dance as a numbered link, and no edit controls', () => {
      renderLineup()

      expect(screen.getByText('1. Chorus Jig')).toBeInTheDocument()
      expect(screen.getByText('2. Money Musk')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reorder dance' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Remove dance' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Add dance' })).not.toBeInTheDocument()
    })

    it('shows a muted placeholder when the lineup is empty', () => {
      renderLineup([])

      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  describe('edit mode', () => {
    async function enterEditMode() {
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Edit dances' }))
      return user
    }

    it('toggles into edit mode, revealing drag handles, remove buttons, and Add dance', async () => {
      renderLineup()
      await enterEditMode()

      expect(screen.getAllByRole('button', { name: 'Reorder dance' })).toHaveLength(2)
      expect(screen.getAllByRole('button', { name: 'Remove dance' })).toHaveLength(2)
      expect(screen.getByRole('button', { name: 'Add dance' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Done editing dances' })).toBeInTheDocument()
    })

    it('toggles back to the plain read-only list', async () => {
      renderLineup()
      const user = await enterEditMode()
      await user.click(screen.getByRole('button', { name: 'Done editing dances' }))

      expect(screen.queryByRole('button', { name: 'Remove dance' })).not.toBeInTheDocument()
      expect(screen.getByText('1. Chorus Jig')).toBeInTheDocument()
    })

    it('still shows the placeholder alongside Add dance when the lineup is empty', async () => {
      renderLineup([])
      await enterEditMode()

      expect(screen.getByText('—')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add dance' })).toBeInTheDocument()
    })

    it('removes a dance via its own remove button, by its junction row id, and renumbers what remains', async () => {
      renderLineup()
      const user = await enterEditMode()
      await user.click(screen.getAllByRole('button', { name: 'Remove dance' })[0])

      expect(removeProgramDanceMock).toHaveBeenCalledWith('pd-1', [
        { programDanceId: 'pd-2', danceId: 'd-2', order: 1, title: 'Money Musk' },
      ])
    })

    it('shows a removal, and the resulting renumbering, immediately - bridging the gap before the dances prop catches up', async () => {
      renderLineup()
      const user = await enterEditMode()
      await user.click(screen.getAllByRole('button', { name: 'Remove dance' })[0])

      // The dances prop hasn't actually changed yet (removeProgramDance's
      // promise is mocked, not wired to any real state) - the optimistic
      // override is what makes the row disappear, and Money Musk move up to
      // "1.", regardless.
      expect(screen.getAllByRole('button', { name: 'Remove dance' })).toHaveLength(1)
      expect(screen.queryByText('1. Chorus Jig')).not.toBeInTheDocument()
      expect(screen.getByText('1. Money Musk')).toBeInTheDocument()
    })

    it('opens a search listing every dance not already in the lineup', async () => {
      renderLineup()
      const user = await enterEditMode()
      await user.click(screen.getByRole('button', { name: 'Add dance' }))

      expect(await screen.findByRole('option', { name: 'Petronella' })).toBeInTheDocument()
      expect(screen.queryByRole('option', { name: 'Chorus Jig' })).not.toBeInTheDocument()
      expect(screen.queryByRole('option', { name: 'Money Musk' })).not.toBeInTheDocument()
    })

    it('adds the picked dance at the end of the lineup, and closes back to the plain Add dance button', async () => {
      renderLineup()
      const user = await enterEditMode()
      await user.click(screen.getByRole('button', { name: 'Add dance' }))
      await user.click(await screen.findByRole('option', { name: 'Petronella' }))

      expect(addProgramDanceMock).toHaveBeenCalledWith('program-1', 'd-3', 3)
      expect(await screen.findByText('3. Petronella')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add dance' })).toBeInTheDocument()
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('appends the first dance at order 1 when the lineup starts out empty', async () => {
      renderLineup([])
      const user = await enterEditMode()
      await user.click(screen.getByRole('button', { name: 'Add dance' }))
      await user.click(await screen.findByRole('option', { name: 'Chorus Jig' }))

      expect(addProgramDanceMock).toHaveBeenCalledWith('program-1', 'd-1', 1)
    })

    it('appends after the current max order, not the last item, when a legacy gap or duplicate is present', async () => {
      renderLineup([
        { programDanceId: 'pd-1', danceId: 'd-1', order: 0, title: 'Chorus Jig' },
        { programDanceId: 'pd-2', danceId: 'd-2', order: 5, title: 'Money Musk' },
      ])
      const user = await enterEditMode()
      await user.click(screen.getByRole('button', { name: 'Add dance' }))
      await user.click(await screen.findByRole('option', { name: 'Petronella' }))

      expect(addProgramDanceMock).toHaveBeenCalledWith('program-1', 'd-3', 6)
    })
  })
})
