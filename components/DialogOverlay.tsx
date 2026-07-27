'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DialogOverlayProps {
  onClose: () => void;
  children: ReactNode;
  closeOnBackdropClick?: boolean;
}

export function DialogOverlay({
  onClose,
  children,
  closeOnBackdropClick = false,
}: DialogOverlayProps) {
  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center px-4">
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default border-0 bg-black/60 [animation:modal-backdrop-in_var(--motion-base)_var(--ease-out)]"
        onClick={() => {
          if (closeOnBackdropClick) {
            onClose();
          }
        }}
        tabIndex={-1}
        aria-label="Nền hộp thoại"
      />
      <div className="relative z-10 flex max-w-full justify-center">
        {children}
      </div>
    </div>,
    document.body,
  );
}
