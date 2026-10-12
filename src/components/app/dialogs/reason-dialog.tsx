"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Confirms a void with a reason for the record. Nothing is deleted: the entry
 * stays visible, marked voided, with who did it, when and why.
 */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<Result>;
  onClose: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      const result = await onConfirm(reason.trim());
      if (!result.ok) return setError(result.error);
      onClose();
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-1.5">
          <Label htmlFor="void-reason">Reason</Label>
          <Textarea
            id="void-reason"
            rows={2}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Recorded on the wrong patient"
          />
          {error && (
            <p role="alert" className="text-sm text-danger-strong">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirm}
            disabled={pending || reason.trim().length < 3}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
