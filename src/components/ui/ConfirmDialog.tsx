import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidthClass="max-w-md">
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-[#E5E9E3] bg-[#F7F8F5] p-3.5 dark:border-[#24332C] dark:bg-[#1C2722]">
          <AlertTriangle
            className={
              variant === 'danger'
                ? 'h-5 w-5 shrink-0 text-[#D9534F] mt-0.5'
                : 'h-5 w-5 shrink-0 text-[#D8A85D] mt-0.5'
            }
          />
          <p className="text-sm leading-relaxed text-[#66736A] dark:text-[#9EADA4]">
            {description}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2.5">
          <Button variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
