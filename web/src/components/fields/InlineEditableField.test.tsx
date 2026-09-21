import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { InlineEditableField } from './InlineEditableField'
import type { RefObject } from 'react'

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// A minimal stand-in for a real Editable* field: an uncontrolled-looking
// input that autoFocuses once rendered (every real field does this one way
// or another - a plain autoFocus here, Select's defaultOpen, tiptapShared's
// focus-on-mount effect elsewhere) and wires its own blur straight to the
// callback InlineEditableField hands it, same as a real field would.
function TestField({ label, initialValue }: { label: string; initialValue: string }) {
  const [isFocused, setIsFocused] = useState(false)
  const [draft, setDraft] = useState(initialValue)

  return (
    <InlineEditableField
      draft={draft}
      error={null}
      isFocused={isFocused}
      onFocus={() => setIsFocused(true)}
      onChange={setDraft}
      onBlur={() => setIsFocused(false)}
      onKeyDown={() => {}}
      renderDisplay={(value) => value}
      renderInput={({ draft, onChange, onBlur, ref }) => (
        <input
          ref={ref as RefObject<HTMLInputElement | null>}
          autoFocus
          aria-label={label}
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      )}
    />
  )
}

describe('InlineEditableField', () => {
  it('a press outside an open field only closes it, without also opening whatever field it lands on', async () => {
    render(
      <>
        <TestField label="field-a" initialValue="Alpha" />
        <TestField label="field-b" initialValue="Beta" />
      </>,
    )

    const user = userEvent.setup()
    await user.click(screen.getByText('Alpha'))
    expect(screen.getByLabelText('field-a')).toHaveFocus()

    await user.click(screen.getByText('Beta'))

    expect(screen.queryByLabelText('field-a')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('field-b')).not.toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('a separate, later click on a different field still opens it normally', async () => {
    render(
      <>
        <TestField label="field-a" initialValue="Alpha" />
        <TestField label="field-b" initialValue="Beta" />
      </>,
    )

    const user = userEvent.setup()
    await user.click(screen.getByText('Alpha'))
    await user.click(screen.getByText('Beta')) // closes field-a, suppresses this open of field-b
    await user.click(screen.getByText('Beta')) // a deliberate, separate press

    expect(screen.getByLabelText('field-b')).toHaveFocus()
  })

  it('still suppresses the open even when a real gap separates the outside press from its click', async () => {
    // A real mousedown-to-click gap (the physical time between pressing and
    // releasing a mouse button) is easily tens of milliseconds - long enough
    // for a naively-short cleanup timer to fire and clear the suppression
    // before the click it was protecting ever arrives. userEvent.click
    // dispatches pointerdown and click back-to-back with no such gap, so it
    // can't catch that regression on its own - this drives the two events
    // separately, with a real wait in between, to reproduce it.
    render(
      <>
        <TestField label="field-a" initialValue="Alpha" />
        <TestField label="field-b" initialValue="Beta" />
      </>,
    )

    const user = userEvent.setup()
    await user.click(screen.getByText('Alpha'))

    fireEvent.pointerDown(screen.getByText('Beta'))
    await wait(50)
    fireEvent.click(screen.getByText('Beta'))

    expect(screen.queryByLabelText('field-b')).not.toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('lets a later, genuinely separate click open a field once the no-click fallback has cleared', async () => {
    // Some fields (Select, notably) appear to preventDefault their own
    // outside pointerdown, which per spec suppresses the browser's
    // follow-up compatibility click entirely - so clearAfterClick never
    // gets a click to reset the flag on, and the fallback timer is what
    // has to do it instead. This reproduces exactly that: a pointerdown
    // outside field-a with no click ever following it at all, then a
    // wholly separate later click on field-b once the fallback has had
    // time to run - that later click must not be treated as though it
    // belongs to the earlier, already-finished gesture.
    render(
      <>
        <TestField label="field-a" initialValue="Alpha" />
        <TestField label="field-b" initialValue="Beta" />
      </>,
    )

    const user = userEvent.setup()
    await user.click(screen.getByText('Alpha'))

    fireEvent.pointerDown(screen.getByText('Beta')) // no matching click follows this one at all
    fireEvent.blur(screen.getByLabelText('field-a')) // field-a closes anyway, the same as Select's own handling does
    await wait(250)

    await user.click(screen.getByText('Beta')) // a distinct, later press
    expect(screen.getByLabelText('field-b')).toHaveFocus()
  })
})
