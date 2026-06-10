import { useEffect, useRef, useState } from 'react';
import Avatar from '../designsystem/components/Avatar';
import Button from '../designsystem/components/Button';

// One selectable person in the picker. The parent normalizes every id to a
// string before passing it in, so equality checks here never trip over the
// number-vs-string mismatch between the auth user (number) and the members API
// (typed string, numeric at runtime).
export interface PickPersonOption {
  id: string;
  name: string;
  email?: string;
  pictureUrl?: string | null;
}

interface PickPersonSelectorProps {
  /** Everyone selectable — the whole group roster, including the caller. */
  members: PickPersonOption[];
  /** The currently-selected person's id (always a string). */
  selectedId: string;
  /** The authenticated caller's id — rendered as "You" and pre-selected. */
  currentUserId: string;
  /**
   * Whether the caller is an admin. Drives ONLY the per-row hint ("edit" vs
   * "view only"); it does NOT gate selection — any member may select any other
   * member to VIEW their picks. Write authority is enforced by the parent and
   * the server, never here.
   */
  isAdmin: boolean;
  /** Reports the chosen person's id. The parent owns the resulting mode. */
  onChange: (id: string) => void;
  /** Disable interaction (e.g. while a submit is in flight). */
  disabled?: boolean;
}

/**
 * Single-select "whose picks am I looking at?" dropdown for the World Cup picks
 * tab. A sibling of SaveTargetsDropdown (which targets GROUPS); this one targets
 * PEOPLE. The caller is always listed first as "You"; selecting anyone else
 * loads that member's picks. Whether those picks are editable (admin) or
 * read-only (everyone else) is decided by the parent — this component only
 * surfaces the choice and a hint about what selecting each person will do.
 */
export default function PickPersonSelector({
  members,
  selectedId,
  currentUserId,
  isAdmin,
  onChange,
  disabled,
}: PickPersonSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape — same affordance as SaveTargetsDropdown.
  useEffect(() => {
    if (!open) return;
    function handleDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Sort the caller to the front, then the rest alphabetically — "You" is always
  // the first, most obvious choice so the default never drifts onto a teammate.
  const ordered = [...members].sort((a, b) => {
    if (a.id === currentUserId) return -1;
    if (b.id === currentUserId) return 1;
    return a.name.localeCompare(b.name);
  });

  const selected = members.find((m) => m.id === selectedId);
  const selectedIsSelf = selectedId === currentUserId;
  const buttonLabel = selectedIsSelf ? 'You' : selected?.name ?? 'Unknown';

  function choose(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative inline-block" data-testid="pick-person-selector">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choose whose picks to view or edit"
      >
        Picking for: {buttonLabel} ▾
      </Button>
      {open && (
        <div
          role="listbox"
          aria-label="Group members"
          className="absolute top-full left-0 mt-xs z-20 w-72 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto rounded-md border border-border bg-neutral-0 p-sm shadow-md dark:bg-secondary-800"
        >
          <ul className="space-y-xxs">
            {ordered.map((m) => {
              const isSelf = m.id === currentUserId;
              const isChecked = m.id === selectedId;
              // Hint copy: editing yourself is implicit; an admin edits others,
              // everyone else only views them.
              const hint = isSelf ? null : isAdmin ? 'edit' : 'view only';
              return (
                <li key={m.id}>
                  <label
                    className="flex cursor-pointer items-center gap-xs rounded-base px-xs py-xxs text-sm hover:bg-secondary-50 dark:hover:bg-secondary-700"
                  >
                    <input
                      type="radio"
                      name="pick-person"
                      checked={isChecked}
                      onChange={() => choose(m.id)}
                      aria-label={isSelf ? `${m.name} (you)` : m.name}
                      className="h-4 w-4"
                    />
                    <Avatar name={m.name} email={m.email} pictureUrl={m.pictureUrl ?? ''} variant="sm" />
                    <span className="flex-1 truncate">
                      {m.name}
                      {isSelf && <span className="ml-xs text-xs text-secondary">(you)</span>}
                    </span>
                    {hint && (
                      <span
                        className={`ml-xs rounded px-xs py-xxxs text-[0.6rem] font-semibold uppercase tracking-wide ${
                          hint === 'edit'
                            ? 'bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-200'
                            : 'bg-secondary-100 text-secondary-600 dark:bg-secondary-700 dark:text-secondary-300'
                        }`}
                      >
                        {hint}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
