import type { BrowseTeam } from '../../../lib/wcGamesView';

/** Minus odds (favorite) → success; plus (underdog) → error. White on the accent fill. */
export function oddsClass(odds: string, selected: boolean): string {
  if (selected) return 'text-accent-fg/85';
  const minus = odds.trim().startsWith('−') || odds.trim().startsWith('-');
  return minus ? 'text-success-600' : 'text-error-500';
}

export interface ChoiceButtonProps {
  /** Omit for the Draw choice. */
  team?: BrowseTeam;
  odds: string;
  record?: string;
  selected: boolean;
  onClick: () => void;
}

/**
 * One outcome in the three-way bet: flag + code prominent, color-coded odds, then
 * W-D-L record. A fixed-height primary row keeps the flag-less Draw aligned with
 * the flagged teams, and the record line is always reserved for uniform rhythm.
 * Shared by the list card and the detail's pick controls.
 */
export default function ChoiceButton({ team, odds, record, selected, onClick }: ChoiceButtonProps) {
  const label = team ? team.abbr : 'Draw';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-1 flex-col items-center gap-xxs rounded-md py-sm text-center transition-colors ${
        selected ? 'bg-accent text-accent-fg' : 'border border-border bg-neutral-0 hover:bg-secondary-50 dark:bg-secondary-900'
      }`}
    >
      <span className="flex h-6 items-center justify-center gap-xs">
        {team && <span className="text-xl leading-none">{team.flag}</span>}
        <span className={`text-base font-extrabold ${selected ? '' : 'text-content'}`}>{label}</span>
      </span>
      <span className={`text-xs font-bold tabular-nums ${oddsClass(odds, selected)}`}>{odds}</span>
      <span className={`text-[0.62rem] tabular-nums ${selected ? 'text-accent-fg/70' : 'text-content-subtle'}`}>
        {record ?? ' '}
      </span>
    </button>
  );
}
