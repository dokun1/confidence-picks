import { useEffect, useRef, useState } from 'react';
import Button from '../designsystem/components/Button';

// One group entry the dropdown can target. The picker pages pre-filter the
// caller's groups by poolType so this component does not need to know about
// NFL vs World Cup.
export interface SaveTarget {
  identifier: string;
  name: string;
}

interface SaveTargetsDropdownProps {
  /** Every group of the right poolType the user belongs to. */
  groups: SaveTarget[];
  /** Identifier of the group that owns the picks page. Always selected, cannot
   * be unchecked — submitting picks without the source group is never useful. */
  sourceIdentifier: string;
  /** Set of identifiers currently selected. */
  selected: Set<string>;
  /** Called with the next selection on every checkbox toggle. */
  onChange: (next: Set<string>) => void;
  /** Optional label suffix, e.g. "World Cup" → "Save to N World Cup groups". */
  label?: string;
  /** True while the parent is loading its group list. */
  loading?: boolean;
  /** Disable interactions (during a submit, etc.). */
  disabled?: boolean;
}

/**
 * Compact "save to N group(s)" dropdown — restores the heritage multi-select
 * UX (Svelte PR #37) that the React rewrite collapsed to a single "all or
 * one" checkbox. Click the button to open a popover with one checkbox per
 * group; the source group is always selected and cannot be unticked.
 */
export default function SaveTargetsDropdown({
  groups,
  sourceIdentifier,
  selected,
  onChange,
  label,
  loading,
  disabled,
}: SaveTargetsDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click. Escape also closes for keyboard users.
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

  function toggleOne(identifier: string) {
    if (identifier === sourceIdentifier) return; // never unselect the source
    const next = new Set(selected);
    if (next.has(identifier)) next.delete(identifier);
    else next.add(identifier);
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(groups.map((g) => g.identifier).concat(sourceIdentifier)));
  }

  function selectOnlySource() {
    onChange(new Set([sourceIdentifier]));
  }

  const count = selected.size;
  const suffix = label ? ` ${label}` : '';
  const buttonText = loading
    ? `Save to:${suffix} groups (loading…)`
    : `Save to: ${count}${suffix} group${count === 1 ? '' : 's'}`;

  return (
    <div ref={rootRef} className="relative inline-block">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choose groups to save picks to"
      >
        {buttonText} ▾
      </Button>
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute bottom-full left-0 mb-xs z-20 w-72 max-h-80 overflow-y-auto rounded-md border border-border bg-neutral-0 p-sm shadow-md dark:bg-secondary-800"
        >
          {/* Bulk actions */}
          {groups.length > 1 && (
            <div className="mb-xs flex justify-between gap-sm border-b border-border pb-xs text-xs">
              <button
                type="button"
                onClick={selectAll}
                className="text-primary-600 hover:underline dark:text-primary-400"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={selectOnlySource}
                className="text-secondary hover:underline"
              >
                Only this group
              </button>
            </div>
          )}
          {loading ? (
            <p className="px-xs py-sm text-sm text-secondary">Loading your groups…</p>
          ) : groups.length === 0 ? (
            <p className="px-xs py-sm text-sm text-secondary">
              You're only in this one group.
            </p>
          ) : (
            <ul className="space-y-xxs">
              {groups.map((g) => {
                const isSource = g.identifier === sourceIdentifier;
                const isChecked = selected.has(g.identifier);
                return (
                  <li key={g.identifier}>
                    <label
                      className={`flex cursor-pointer items-center gap-xs rounded-base px-xs py-xxs text-sm hover:bg-secondary-50 dark:hover:bg-secondary-700 ${
                        isSource ? 'opacity-90' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isSource}
                        onChange={() => toggleOne(g.identifier)}
                        aria-label={isSource ? `${g.name} (current group)` : g.name}
                        className="h-4 w-4"
                      />
                      <span className="flex-1 truncate">
                        {g.name}
                        {isSource && (
                          <span className="ml-xs text-xs text-secondary">(current)</span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
