import { describe, expect, it } from 'vitest'
import { beatsRemainingInSpan, computePhraseLabel, getDefaultSkeleton } from './phraseSkeleton'

describe('getDefaultSkeleton', () => {
  it('returns the standard 4x16-beat skeleton for Contra', () => {
    expect(getDefaultSkeleton('Contra')).toEqual([
      { label: 'A1', beats: 16 },
      { label: 'A2', beats: 16 },
      { label: 'B1', beats: 16 },
      { label: 'B2', beats: 16 },
    ])
  })

  it('returns null for every other dance type, including Mixer', () => {
    expect(getDefaultSkeleton('Mixer')).toBeNull()
    expect(getDefaultSkeleton('Square')).toBeNull()
    expect(getDefaultSkeleton('ECD')).toBeNull()
    expect(getDefaultSkeleton('Other')).toBeNull()
    expect(getDefaultSkeleton(null)).toBeNull()
  })
})

describe('computePhraseLabel', () => {
  const skeleton = getDefaultSkeleton('Contra')!

  it('labels a figure by which span its cumulative beats before it falls in', () => {
    expect(computePhraseLabel(0, skeleton)).toBe('A1')
    expect(computePhraseLabel(15, skeleton)).toBe('A1')
    expect(computePhraseLabel(16, skeleton)).toBe('A2')
    expect(computePhraseLabel(31, skeleton)).toBe('A2')
    expect(computePhraseLabel(32, skeleton)).toBe('B1')
    expect(computePhraseLabel(48, skeleton)).toBe('B2')
  })

  it('clamps to the last span once the total runs past the end of the skeleton', () => {
    expect(computePhraseLabel(63, skeleton)).toBe('B2')
    expect(computePhraseLabel(64, skeleton)).toBe('B2')
    expect(computePhraseLabel(200, skeleton)).toBe('B2')
  })
})

describe('beatsRemainingInSpan', () => {
  const skeleton = getDefaultSkeleton('Contra')!

  it('returns beats left in the current span', () => {
    expect(beatsRemainingInSpan(0, skeleton)).toBe(16)
    expect(beatsRemainingInSpan(8, skeleton)).toBe(8)
    expect(beatsRemainingInSpan(15, skeleton)).toBe(1)
    expect(beatsRemainingInSpan(16, skeleton)).toBe(16)
  })

  it('falls back to the last span length once past the end of the skeleton', () => {
    expect(beatsRemainingInSpan(64, skeleton)).toBe(16)
    expect(beatsRemainingInSpan(200, skeleton)).toBe(16)
  })
})
