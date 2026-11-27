import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidthClass = 'max-w-lg',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, panelRef);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="finora-modal-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#102F27]/40 backdrop-blur-[2px]"
          />
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={cn(
              'relative z-10 w-full rounded-xl border border-[#E5E9E3] bg-white p-6 shadow-xl dark:border-[#24332C] dark:bg-[#151E1A] max-h-[90vh] overflow-y-auto',
              maxWidthClass,
            )}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2
                  id="finora-modal-title"
                  className="font-display text-lg font-semibold text-[#18231E] dark:text-[#EDF2EE]"
                >
                  {title}
                </h2>
                {description ? (
                  <p className="mt-1 text-xs text-[#66736A] dark:text-[#9EADA4]">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-[#66736A] transition-colors hover:bg-[#EEF1EC] hover:text-[#18231E] dark:text-[#9EADA4] dark:hover:bg-[#1C2722] dark:hover:text-[#EDF2EE] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
