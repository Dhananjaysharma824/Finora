import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
}: DrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  useFocusTrap(open, drawerRef);

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
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="finora-drawer-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#102F27]/35 backdrop-blur-[1px]"
          />
          <motion.aside
            ref={drawerRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#E5E9E3] bg-white shadow-2xl dark:border-[#24332C] dark:bg-[#151E1A]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#E5E9E3] px-6 py-5 dark:border-[#24332C]">
              <div>
                <h2
                  id="finora-drawer-title"
                  className="font-display text-lg font-semibold text-[#18231E] dark:text-[#EDF2EE]"
                >
                  {title}
                </h2>
                {description ? (
                  <p className="mt-0.5 text-xs text-[#66736A] dark:text-[#9EADA4]">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="rounded-lg p-1.5 text-[#66736A] transition-colors hover:bg-[#EEF1EC] hover:text-[#18231E] dark:text-[#9EADA4] dark:hover:bg-[#1C2722] dark:hover:text-[#EDF2EE] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
