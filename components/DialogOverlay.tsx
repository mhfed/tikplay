'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DialogOverlayProps {
  onClose: () => void;
  children: ReactNode;
}

export function DialogOverlay({ onClose, children }: DialogOverlayProps) {
  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center px-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-black/60 [animation:modal-backdrop-in_var(--motion-base)_var(--ease-out)]"
        onClick={onClose}
        aria-label="Đóng hộp thoại"
      />
      {children}
    </div>,
    document.body,
  );
}
