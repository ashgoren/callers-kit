import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { formatDate, mutedPlaceholder, sortAlphabetically } from './format'

describe('formatDate', () => {
  it('formats an ISO timestamp as M/d/yy', () => {
    expect(formatDate('2026-03-05T12:00:00Z')).toBe('3/5/26')
  })

  it('renders a dash for null', () => {
    expect(formatDate(null)).toBe('—')
  })
})

describe('sortAlphabetically', () => {
  it('sorts case- and accent-insensitively without mutating the input array', () => {
    const values = ['bob', 'Amy', 'Émile']

    const sorted = sortAlphabetically(values)

    expect(sorted).toEqual(['Amy', 'bob', 'Émile'])
    expect(values).toEqual(['bob', 'Amy', 'Émile']) // original left untouched
  })

  it('returns an empty array unchanged', () => {
    expect(sortAlphabetically([])).toEqual([])
  })
})

describe('mutedPlaceholder', () => {
  it('renders a muted dash', () => {
    render(mutedPlaceholder)

    expect(screen.getByText('—')).toHaveClass('text-muted-foreground')
  })
})
