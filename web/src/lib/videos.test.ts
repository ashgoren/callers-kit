import { describe, expect, it } from 'vitest'
import { appendVideo, removeVideoItem, updateVideoItem } from './videos'
import type { Video } from './videos'

function makeVideos(): Video[] {
  return [
    { id: 'v1', url: 'https://example.com/a', description: 'Official teach' },
    { id: 'v2', url: 'https://example.com/b', description: 'Filmed live' },
  ]
}

describe('updateVideoItem', () => {
  it("patches one video's own field, leaving every other item untouched", () => {
    const result = updateVideoItem(makeVideos(), 'v1', { description: 'Updated description' })
    expect(result[0]).toEqual({ id: 'v1', url: 'https://example.com/a', description: 'Updated description' })
    expect(result[1]).toEqual({ id: 'v2', url: 'https://example.com/b', description: 'Filmed live' })
  })

  it('returns a new array without mutating the original', () => {
    const original = makeVideos()
    const result = updateVideoItem(original, 'v1', { url: 'https://example.com/changed' })
    expect(original[0]).toMatchObject({ url: 'https://example.com/a' })
    expect(result).not.toBe(original)
  })
})

describe('removeVideoItem', () => {
  it('removes the item with the given id', () => {
    expect(removeVideoItem(makeVideos(), 'v1')).toEqual([{ id: 'v2', url: 'https://example.com/b', description: 'Filmed live' }])
  })

  it('leaves the array unchanged if the id is not found', () => {
    const original = makeVideos()
    expect(removeVideoItem(original, 'missing')).toEqual(original)
  })
})

describe('appendVideo', () => {
  it('appends a blank video with a fresh id', () => {
    const result = appendVideo(makeVideos())
    expect(result).toHaveLength(3)
    expect(result[2]).toMatchObject({ url: '', description: '' })
    expect(result[2].id).toBeTruthy()
  })
})
