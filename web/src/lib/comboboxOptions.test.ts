import { describe, expect, it } from 'vitest'
import { buildCreatableComboboxItems, CREATE_OPTION_ID } from './comboboxOptions'

const GRANGE_HALL = { id: 'loc-1', label: 'Grange Hall' }
const TOWN_HALL = { id: 'loc-2', label: 'Town Hall' }
const FIRE_HALL = { id: 'loc-3', label: 'Fire Hall' }
const OPTIONS = [GRANGE_HALL, TOWN_HALL, FIRE_HALL]

describe('buildCreatableComboboxItems', () => {
  it('returns every option as-is when the query is blank and nothing is selected', () => {
    expect(buildCreatableComboboxItems(OPTIONS, '', [])).toEqual(OPTIONS)
  })

  it('pins the currently selected option first when the query is blank (single-select)', () => {
    expect(buildCreatableComboboxItems(OPTIONS, '', [TOWN_HALL.id])).toEqual([TOWN_HALL, GRANGE_HALL, FIRE_HALL])
  })

  it('pins every currently selected option first when the query is blank (multi-select), in options\' own order rather than the order given', () => {
    expect(buildCreatableComboboxItems(OPTIONS, '', [FIRE_HALL.id, GRANGE_HALL.id])).toEqual([
      GRANGE_HALL,
      FIRE_HALL,
      TOWN_HALL,
    ])
  })

  it('falls back to returning every option unchanged when none of the selected ids matches an option', () => {
    expect(buildCreatableComboboxItems(OPTIONS, '', ['no-such-id'])).toEqual(OPTIONS)
  })

  it('filters to case-insensitive substring matches on label', () => {
    // Only a substring match, not an exact one ('grange' !== 'grange hall'),
    // so a create entry is still appended - see the exact-match test below
    // for the case where that's suppressed.
    expect(buildCreatableComboboxItems(OPTIONS, 'grange', [])).toEqual([
      GRANGE_HALL,
      { id: CREATE_OPTION_ID, label: 'grange' },
    ])
  })

  it('trims the query before matching', () => {
    expect(buildCreatableComboboxItems(OPTIONS, '  hall  ', [])).toEqual([
      GRANGE_HALL,
      TOWN_HALL,
      FIRE_HALL,
      { id: CREATE_OPTION_ID, label: 'hall' },
    ])
  })

  it('appends a synthetic create entry when nothing matches the query exactly', () => {
    expect(buildCreatableComboboxItems(OPTIONS, 'Fire Station', [])).toEqual([
      { id: CREATE_OPTION_ID, label: 'Fire Station' },
    ])
  })

  it('does not append a create entry once the query exactly matches an existing option (case-insensitive)', () => {
    expect(buildCreatableComboboxItems(OPTIONS, 'grange hall', [])).toEqual([GRANGE_HALL])
  })

  it('still appends create alongside partial matches, when none of them is an exact match', () => {
    expect(buildCreatableComboboxItems(OPTIONS, 'Hall', [])).toEqual([
      GRANGE_HALL,
      TOWN_HALL,
      FIRE_HALL,
      { id: CREATE_OPTION_ID, label: 'Hall' },
    ])
  })
})
