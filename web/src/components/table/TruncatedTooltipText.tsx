import { useEffect, useRef, useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// Renders `children` as a single truncatable line, enabling the hover
// tooltip (revealing `content` - typically the same text in full) only once
// the rendered line is actually being clipped, since it would otherwise just
// repeat text that's already fully visible. Same approach as the old app's
// TooltipCell component: scrollWidth vs clientWidth via a ResizeObserver, so
// a column drag-resize or window resize (not just a content change)
// re-triggers the check.
export function TruncatedTooltipText({ children, content }: { children: string; content: string }) {
  const [isTruncated, setIsTruncated] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const checkTruncation = () => {
      if (ref.current) setIsTruncated(ref.current.scrollWidth > ref.current.clientWidth)
    }
    checkTruncation()

    const observer = new ResizeObserver(checkTruncation)
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [content])

  return (
    <Tooltip>
      <TooltipTrigger disabled={!isTruncated} className="block w-full">
        <span ref={ref} className="block truncate">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  )
}
