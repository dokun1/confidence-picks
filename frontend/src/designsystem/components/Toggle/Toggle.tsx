export interface ToggleProps {
  /** Current state. Controlled — the parent owns the value. */
  checked: boolean;
  /** Fired with the requested next state. */
  onChange: (next: boolean) => void;
  /** Visible label rendered beside the switch. */
  label: string;
  /** Optional helper text below the label, explaining what turning it on does. */
  description?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * An on/off switch.
 *
 * Built on a native `<button role="switch">` rather than a styled checkbox: the
 * switch role is what tells a screen reader "this takes effect immediately"
 * instead of "this will be submitted with a form", which is the actual behavior
 * everywhere it is used here.
 *
 * The whole row is the hit target — label included — so it stays comfortably
 * tappable on a phone, where these settings are most often changed.
 */
export default function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
}: ToggleProps) {
  const labelId = id ? `${id}-label` : undefined;
  const descriptionId = description && id ? `${id}-description` : undefined;

  return (
    <div className="flex items-start justify-between gap-md">
      <div className="flex-1">
        <label
          id={labelId}
          htmlFor={id}
          className="block text-sm font-medium text-[var(--color-text-primary)]"
        >
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="mt-xxxs text-sm text-[var(--color-text-secondary)]">
            {description}
          </p>
        )}
      </div>

      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-pill border-2 border-transparent',
          'transition-colors duration-normal ease-smooth',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-accent' : 'bg-secondary-300 dark:bg-secondary-700',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className={[
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-neutral-0 shadow-sm',
            'transition-transform duration-normal ease-smooth',
            checked ? 'translate-x-5' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
    </div>
  );
}
