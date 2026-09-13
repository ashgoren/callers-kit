import { describe, expect, it } from 'vitest'
import { parseNullableJsonArray } from './json'

describe('parseNullableJsonArray', () => {
  it('returns null unchanged, without attempting to parse it', () => {
    expect(parseNullableJsonArray(null)).toBeNull()
  })

  it('parses a JSON-encoded array string into a real array', () => {
    expect(parseNullableJsonArray<string>('["a","b"]')).toEqual(['a', 'b'])
  })

  it('parses an empty array string into an empty array, distinct from null', () => {
    expect(parseNullableJsonArray('[]')).toEqual([])
  })
})
