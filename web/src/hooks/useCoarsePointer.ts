import { useEffect, useState } from 'react'

// True when the primary pointer is coarse (touch) rather than fine (mouse/trackpad).
// This is a JS-side decision (which markup/handlers to use), not just a styling one -
// for styling alone, Tailwind's pointer-coarse:/pointer-fine: variants on the same
// media feature are usually enough on their own, without needing this hook.
export function useCoarsePointer(): boolean {
  const [isCoarse, setIsCoarse] = useState(() => window.matchMedia('(pointer: coarse)').matches)

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)')
    const onChange = () => setIsCoarse(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return isCoarse
}
