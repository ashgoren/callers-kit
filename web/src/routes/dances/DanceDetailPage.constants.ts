import { z } from 'zod'
import { mutedPlaceholder } from '@/lib/format'
import type { ReactNode } from 'react'

// Non-negative integer so difficulty stays sortable; null (unset) is also allowed.
export const difficultySchema = z.number().int().min(0).nullable()

// Empty string means "not set yet".
export const urlSchema = z.url().or(z.literal(''))

// Fixed, admin-managed vocabularies - mirrors the public.dance_type/
// formation/progression enums in the Supabase schema exactly.
export const DANCE_TYPES = ['Contra', 'Square', 'ECD', 'Mixer', 'Other']
export const FORMATIONS = [
  'Duple Minor - Improper',
  'Duple Minor - Becket',
  'Duple Minor - Becket CCW',
  'Duple Minor',
  'Duple Minor - Proper',
  'Duple Minor - Indecent',
  'Duple Minor - Reverse progression improper',
  'Duple Minor - Progressed improper',
  'Duple Minor - Cross',
  'Duple Minor - Other',
  'Triple Minor',
  'Three Facing Three',
  'Four Facing Four',
  'Solo',
  'Singlet',
  'Doublet',
  'Triplet',
  'Quadruplet',
  'Longways: 5+ couples',
  'Other Longways',
  'Circle Mixer',
  'Circle of Threesomes',
  'Sicilian Circle',
  'Scatter Mixer',
  'Grid Contra',
  'Grid Square',
  'Zia',
  'other',
]
export const PROGRESSIONS = ['Single', 'Double', 'Triple', 'None', 'Other']

// Show shortened version of url for caller's box
export function formatUrl(url: string): ReactNode {
  if (!url) return mutedPlaceholder
  const ibiblioId = /ibiblio\.org\/contradance\/thecallersbox\/dance\.php\?id=(\d+)/.exec(url)?.[1]
  return ibiblioId ? `Caller's Box ${ibiblioId}` : url
}
