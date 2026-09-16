// A plain module-level registry, not React state - it only ever needs to
// answer a synchronous "is anything unsaved right now?" question at the
// moment a navigation is attempted (see AppShell's useBlocker/
// useBeforeUnload), not to drive a re-render of anything itself. A Set of
// field ids (rather than a plain counter) is self-correcting against a
// double-registration or a missed cleanup: adding an id that's already
// present, or removing one that's already absent, is a harmless no-op
// either way.
const dirtyFieldIds = new Set<string>()

export function setRichTextFieldDirty(id: string, isDirty: boolean): void {
  if (isDirty) {
    dirtyFieldIds.add(id)
  } else {
    dirtyFieldIds.delete(id)
  }
}

export function hasUnsavedRichText(): boolean {
  return dirtyFieldIds.size > 0
}
