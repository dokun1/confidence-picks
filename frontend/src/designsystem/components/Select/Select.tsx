export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  /** Shown as a disabled first option when `value` is empty. */
  placeholder?: string;
  helperText?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * A labelled dropdown.
 *
 * Wraps a native `<select>` rather than a custom listbox: the native control
 * gets the platform picker on mobile (a full-height wheel on iOS rather than a
 * cramped popover), keyboard and screen-reader behavior for free, and it is the
 * right choice for short, flat option lists like "which member collects dues".
 * Sizing and border tokens mirror TextField so the two line up in a form.
 */
export default function Select({
  value,
  onChange,
  options,
  label,
  placeholder,
  helperText,
  disabled = false,
  id,
}: SelectProps) {
  const helperId = helperText && id ? `${id}-helper` : undefined;

  return (
    <div className="space-y-xxxs">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-[var(--color-text-primary)]">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-describedby={helperId}
        onChange={(e) => onChange(e.target.value)}
        className={[
          'w-full rounded-base border bg-neutral-0 px-sm py-xs text-base h-[2.5rem]',
          'border-secondary-300 text-[var(--color-text-primary)]',
          'transition-colors duration-normal ease-smooth',
          'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'dark:bg-secondary-900 dark:border-secondary-600 dark:focus:border-primary-400 dark:focus:ring-primary-400',
        ].join(' ')}
      >
        {placeholder && (
          <option value="" disabled={false}>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {helperText && (
        <p id={helperId} className="text-sm text-[var(--color-text-secondary)]">
          {helperText}
        </p>
      )}
    </div>
  );
}
