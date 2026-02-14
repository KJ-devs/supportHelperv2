/**
 * Ticket Checkbox Component
 * Checkbox pour sélection multiple de tickets
 */

'use client';

interface TicketCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function TicketCheckbox({ checked, onChange, disabled = false }: TicketCheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
      onClick={(e) => e.stopPropagation()}
    />
  );
}
