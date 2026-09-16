import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// Confirms discarding an open, unsaved rich-text field (see
// src/lib/unsavedRichText.ts) before some other action proceeds - leaving
// the page entirely, or switching to a different record within one. `open`
// is driven directly by the caller, which owns whatever state decided a
// confirmation was needed in the first place (a react-router blocker, a
// pending navigation target, etc.) - this component only renders the dialog.
export function UnsavedChangesDialog({
  open,
  title,
  description,
  confirmLabel,
  onStay,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onStay: () => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onStay()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStay}>Stay</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
