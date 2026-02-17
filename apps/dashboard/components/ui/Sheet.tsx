/**
 * Sheet Component
 * Mobile drawer/dialog component with overlay and slide-in animation
 */

'use client';

import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  side?: 'left' | 'right';
}

export function Sheet({ isOpen, onClose, children, side = 'left' }: SheetProps) {
  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (typeof window === 'undefined') return null;

  const slideDirection = side === 'left' ? '-translate-x-full' : 'translate-x-full';
  const slideIn = 'translate-x-0';

  return createPortal(
    <div className={`fixed inset-0 z-50 ${isOpen ? '' : 'pointer-events-none'}`}>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className={`fixed inset-y-0 ${side}-0 w-[280px] max-w-[85vw] bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? slideIn : slideDirection
        }`}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

interface SheetContentProps {
  children: ReactNode;
}

export function SheetContent({ children }: SheetContentProps) {
  return <div className="flex flex-col h-full">{children}</div>;
}

interface SheetHeaderProps {
  children: ReactNode;
}

export function SheetHeader({ children }: SheetHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700 shrink-0">
      {children}
    </div>
  );
}

interface SheetTitleProps {
  children: ReactNode;
}

export function SheetTitle({ children }: SheetTitleProps) {
  return <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{children}</h2>;
}

interface SheetCloseProps {
  onClick: () => void;
}

export function SheetClose({ onClick }: SheetCloseProps) {
  return (
    <button
      onClick={onClick}
      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 -mr-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors touch-manipulation"
      aria-label="Close"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

interface SheetBodyProps {
  children: ReactNode;
}

export function SheetBody({ children }: SheetBodyProps) {
  return <div className="flex-1 overflow-y-auto">{children}</div>;
}

interface SheetFooterProps {
  children: ReactNode;
}

export function SheetFooter({ children }: SheetFooterProps) {
  return (
    <div className="border-t dark:border-gray-700 p-4 shrink-0">
      {children}
    </div>
  );
}
