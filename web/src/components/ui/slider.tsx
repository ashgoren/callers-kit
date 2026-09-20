import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "cn"

// Pinned to a single number value, not Base UI's own number | readonly number[]
function Slider({
  className,
  "aria-label": ariaLabel,
  ...props
}: SliderPrimitive.Root.Props<number> & { "aria-label"?: string }) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("relative flex w-full touch-none items-center select-none data-disabled:opacity-50", className)}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full items-center py-2">
        <SliderPrimitive.Track className="relative h-1.5 w-full grow rounded-full bg-muted">
          <SliderPrimitive.Indicator className="absolute h-full rounded-full bg-primary" />
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            // Root's own aria-label would land on its wrapping (role="group")
            // div, not the actual role="slider" <input> nested inside Thumb -
            // getAriaLabel is Base UI's own mechanism for naming that input.
            getAriaLabel={ariaLabel ? () => ariaLabel : undefined}
            className="block size-4 shrink-0 rounded-full border border-primary bg-background shadow transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
          />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
