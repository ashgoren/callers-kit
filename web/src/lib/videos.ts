import { z } from 'zod'

// A dance's list of related videos - each a URL plus a short description
// stored as a JSON-encoded array directly on the dances row via jsonColumn().
export interface Video {
  id: string
  url: string
  description: string
}

export const videoUrlSchema = z.url()

export function updateVideoItem(items: Video[], itemId: string, patch: Partial<Video>): Video[] {
  return items.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
}

export function removeVideoItem(items: Video[], itemId: string): Video[] {
  return items.filter((item) => item.id !== itemId)
}

export function appendVideo(items: Video[]): Video[] {
  return [...items, { id: crypto.randomUUID(), url: '', description: '' }]
}
