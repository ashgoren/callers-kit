import { useEffect, useState } from 'react'

// Toggles body.is-dragging-column while a drag-to-reorder is in progress,
// and index.css forces grab cursor everywhere on screen for that class.
export function useDragBodyClass(): [boolean, (isDragging: boolean) => void] {
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (!isDragging) return
    document.body.classList.add('is-dragging-column')
    return () => document.body.classList.remove('is-dragging-column')
  }, [isDragging])

  return [isDragging, setIsDragging]
}
