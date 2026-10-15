"use client";

import { ConfirmButton } from "@/components/ui/confirm-button";
import { undoEmailRejectionAction } from "@/server/actions/email-sync";

export function UndoRejectionButton({ eventId, company }: { eventId: string; company: string }) {
  return (
    <ConfirmButton
      title={`Undo the rejection for ${company}?`}
      message="The application goes back to the stage it had before this email. This email won't be applied again."
      confirmLabel="Undo"
      confirmVariant="primary"
      variant="secondary"
      onConfirm={() => undoEmailRejectionAction(eventId)}
    >
      Undo
    </ConfirmButton>
  );
}
