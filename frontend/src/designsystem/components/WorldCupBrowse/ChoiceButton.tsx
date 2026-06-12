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
  odds?: string;
  record?: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * One outcome in the three-way bet: logo + code prominent, color-coded odds, then
 * W-D-L record. A fixed-height primary row keeps the logo-less Draw aligned with
 * the logo'd teams. Odds and record are optional and only rendered when present.
 * Shared by the list card and the detail's pick controls.
 */
export default function ChoiceButton({ team, odds, record, selected, onClick, disabled }: ChoiceButtonProps) {
  const label = team ? team.abbr : 'Draw';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      disabled={disabled}
      className={`flex flex-1 flex-col items-center gap-xxs rounded-md px-sm py-sm text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        selected ? 'bg-accent text-accent-fg' : 'border border-border bg-neutral-0 hover:bg-secondary-50 dark:bg-secondary-900'
      }`}
    >
      <span className="flex h-7 w-full items-center justify-center gap-sm">
        {team && <img src={team.logo} alt="" className="h-icon-md w-icon-md object-contain" />}
        <span className={`text-lg font-extrabold ${selected ? '' : 'text-content'}`}>{label}</span>
      </span>
      {odds && <span className={`text-xs font-bold tabular-nums ${oddsClass(odds, selected)}`}>{odds}</span>}
      {record && (
        <span className={`text-[0.62rem] tabular-nums ${selected ? 'text-accent-fg/70' : 'text-content-subtle'}`}>{record}</span>
      )}
    </button>
  );
}
