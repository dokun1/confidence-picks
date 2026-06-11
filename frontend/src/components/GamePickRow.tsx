import { useEffect, useRef, useState } from 'react';
import Button from '../designsystem/components/Button';

// Page-level row component ported from GamePickRow.svelte (commit d6b2566^).
// It renders one game as a pick row: pick a winner (radiogroup of the two teams)
// and assign a confidence value via a popover. The parent (GamesPage) owns the
// draft and the cross-game "each confidence used once" invariant; this row only
// surfaces the values it is allowed to offer and emits intent up.

/** A team as returned by the public /api/games endpoint. id may be string or number. */
export interface PickTeam {
  id: string | number;
  name: string;
  abbreviation: string;
  logo?: string | null;
  color?: string | null;
}

/** Betting line, optional and only shown for not-started games. */
export interface PickOdds {
  favoriteAbbr?: string | null;
  spread?: number | null;
  overUnder?: number | null;
  provider?: string | null;
  details?: string | null;
}

/**
 * A game from /api/games. The public endpoint carries no per-user `pick` or
 * `meta`, so `final`/`locked` are derived from `status`; the optional `meta`
 * field is honored when a richer (group-scoped) payload supplies it.
 */
export interface PickGame {
  id: number;
  awayTeam: PickTeam;
  homeTeam: PickTeam;
  awayScore?: number;
  homeScore?: number;
  status: string;
  gameDate: string;
  displayClock?: string;
  period?: number;
  odds?: PickOdds | null;
  meta?: { locked?: boolean; final?: boolean };
}

/** One game's draft selection. Either field may be set independently mid-edit. */
export interface DraftPick {
  pickedTeamId: number | null;
  confidence: number | null;
}

export interface GamePickRowProps {
  game: PickGame;
  /** Current draft for this game, or null when nothing is selected yet. */
  pick: DraftPick | null;
  /** N — the number of games in the week; confidence range is 1..N. */
  totalGames: number;
  /** Confidence values currently taken by OTHER games (drives duplicate prevention). */
  usedConfidences: Set<number>;
  /** When true (sorted list), offer the full 1..N range so the user can reassign. */
  isSorted?: boolean;
  /** Page-level disable (no group selected, or a submit is in flight). */
  disabled?: boolean;
  onToggleWinner: (teamId: number) => void;
  onAssignConfidence: (value: number | null) => void;
  onClearPick: () => void;
}

/** Map the backend status enum to a human label, matching the Svelte source. */
function deriveStatus(status: string): 'final' | 'in progress' | 'not started' {
  switch (status) {
    case 'FINAL':
      return 'final';
    case 'IN_PROGRESS':
      return 'in progress';
    default:
      return 'not started';
  }
}

/** Pick black or white text for a team's background color by relative luminance. */
function readableTextColor(hex?: string | null): string {
  if (!hex) return '#000';
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#000';
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.6 ? '#000' : '#fff';
}

function teamStyle(team: PickTeam): React.CSSProperties {
  if (!team.color) return {};
  const bg = `#${team.color.replace('#', '')}`;
  return { background: bg, color: readableTextColor(team.color) };
}

function formatGameDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const STATUS_BADGE: Record<ReturnType<typeof deriveStatus>, string> = {
  final: 'bg-success-600 text-neutral-0',
  'in progress': 'bg-error-600 text-neutral-0',
  'not started': 'bg-secondary-200 text-secondary-700 dark:bg-secondary-700 dark:text-secondary-200',
};

export default function GamePickRow({
  game,
  pick,
  totalGames,
  usedConfidences,
  isSorted = false,
  disabled = false,
  onToggleWinner,
  onAssignConfidence,
  onClearPick,
}: GamePickRowProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close the popover on an outside click (mirrors the Svelte backdrop).
  useEffect(() => {
    if (!showPicker) return;
    function onDocClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showPicker]);

  const status = deriveStatus(game.status);
  // Public games carry no `meta`; derive from status. Honor a richer payload if present.
  const final = game.meta?.final ?? status === 'final';
  const locked = game.meta?.locked ?? status !== 'not started';
  const editable = !final && !locked && !disabled;

  const awayTeamId = Number(game.awayTeam.id);
  const homeTeamId = Number(game.homeTeam.id);
  const pickTeamId = pick?.pickedTeamId != null ? Number(pick.pickedTeamId) : null;
  const awaySelected = pickTeamId != null && pickTeamId === awayTeamId;
  const homeSelected = pickTeamId != null && pickTeamId === homeTeamId;

  const confidence = pick?.confidence ?? null;
  const completePick = pick != null && pick.pickedTeamId != null && pick.confidence != null;

  // Allowed confidence values: a complete pick (or a row in the sorted list) may
  // reassign to any value (the parent releases the previous holder); an
  // incomplete pick may only take a value not already used by another game.
  const full = Array.from({ length: totalGames }, (_, i) => i + 1);
  const allowedConfidences =
    completePick || isSorted
      ? full
      : full.filter((n) => !usedConfidences.has(n) || confidence === n);

  const canClear = editable && (pick?.pickedTeamId != null || pick?.confidence != null);

  function chooseConfidence(val: number) {
    onAssignConfidence(val);
    setShowPicker(false);
  }

  function onTeamKey(e: React.KeyboardEvent, teamId: number) {
    if (!editable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleWinner(teamId);
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      onToggleWinner(teamId === homeTeamId ? awayTeamId : homeTeamId);
    }
  }

  function renderTeam(team: PickTeam, teamId: number, selected: boolean) {
    return (
      <div
        role="radio"
        aria-checked={selected}
        aria-label={`Pick ${team.name} to win`}
        tabIndex={editable ? 0 : -1}
        onClick={() => editable && onToggleWinner(teamId)}
        onKeyDown={(e) => onTeamKey(e, teamId)}
        style={teamStyle(team)}
        className={[
          'relative flex items-center justify-between gap-sm rounded-base px-sm py-xs transition-all',
          editable ? 'cursor-pointer' : 'cursor-default',
          selected ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-surface' : '',
        ].join(' ')}
      >
        {selected && (
          <span
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-success-600 text-xs font-bold text-neutral-0"
            aria-hidden="true"
            title="Picked to win"
          >
            ✓
          </span>
        )}
        <span className="flex items-center gap-xs">
          {team.logo && (
            <img className="h-9 w-9 object-contain" alt={team.abbreviation} src={team.logo} />
          )}
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">{team.abbreviation}</span>
            <span className="text-[0.6rem] uppercase tracking-wide opacity-80">{team.name}</span>
          </span>
        </span>
        <span className="min-w-[2ch] text-right text-xl font-bold tabular-nums">
          {team.id === game.awayTeam.id ? game.awayScore ?? 0 : game.homeScore ?? 0}
        </span>
      </div>
    );
  }

  return (
    <div
      id={`game-row-${game.id}`}
      data-testid={`game-row-${game.id}`}
      className={[
        'flex flex-col gap-sm rounded-md border bg-surface p-sm shadow-sm',
        pick && !completePick && editable ? 'border-warning-500 border-dashed' : 'border-border',
      ].join(' ')}
    >
      <div className="flex items-center justify-between border-b border-border pb-xs">
        <span className="text-xs text-content-muted">{formatGameDate(game.gameDate)}</span>
        <div className="flex items-center gap-xs">
          <span
            className={`rounded px-xs py-xxxs text-[0.6rem] font-semibold uppercase tracking-wide ${STATUS_BADGE[status]}`}
          >
            {status === 'in progress'
              ? [game.displayClock, game.period ? `Q${game.period}` : null]
                  .filter(Boolean)
                  .join(' · ') || 'in progress'
              : status}
          </span>
          {canClear && (
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onClearPick();
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-stretch gap-sm" role="radiogroup" aria-label="Select winner">
        <div className="flex flex-1 flex-col gap-xs">
          {renderTeam(game.awayTeam, awayTeamId, awaySelected)}
          <span className="px-sm text-xs text-content-muted">@</span>
          {renderTeam(game.homeTeam, homeTeamId, homeSelected)}
        </div>

        {/* Confidence control */}
        <div ref={pickerRef} className="relative flex items-center justify-center">
          {final ? (
            <div
              className="flex min-w-[2.8ch] items-center justify-center rounded-md bg-secondary-200 px-sm py-xs text-xl font-bold tabular-nums dark:bg-secondary-700"
              title={confidence != null ? `Confidence ${confidence}` : 'No pick'}
            >
              {confidence ?? '—'}
            </div>
          ) : !editable ? (
            <div
              className="flex min-w-[2.8ch] items-center justify-center rounded-md bg-secondary-200 px-sm py-xs text-sm font-semibold dark:bg-secondary-700"
              title="Locked"
            >
              {confidence ?? '—'}
            </div>
          ) : (
            <>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={showPicker}
                aria-label={`Confidence for ${game.awayTeam.abbreviation} at ${game.homeTeam.abbreviation}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPicker((s) => !s);
                }}
                className="flex min-w-[2.8ch] flex-col items-center justify-center gap-xxxs rounded-md bg-accent px-sm py-xs font-bold text-accent-fg shadow-sm hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent"
                title={confidence != null ? `Confidence ${confidence}` : 'Select confidence'}
              >
                <span className="text-xl tabular-nums">{confidence ?? '—'}</span>
                <span className="text-[0.55rem] leading-none opacity-80" aria-hidden="true">
                  ▲▼
                </span>
              </button>
              {showPicker && (
                <div
                  role="listbox"
                  aria-label="Select confidence"
                  className="absolute right-0 top-full z-30 mt-xs grid min-w-[200px] grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-xs rounded-md border border-border bg-surface p-xs shadow-md"
                >
                  {allowedConfidences.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="option"
                      aria-selected={c === confidence}
                      onClick={() => chooseConfidence(c)}
                      className={[
                        'rounded-base px-xs py-xxs text-sm font-semibold transition-colors',
                        c === confidence
                          ? 'bg-accent text-accent-fg'
                          : 'bg-secondary-100 text-secondary-900 hover:bg-accent hover:text-accent-fg dark:bg-secondary-700 dark:text-secondary-100',
                      ].join(' ')}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!final && status === 'not started' && game.odds && (
        <div className="flex items-center gap-xs text-[0.65rem] font-semibold text-content-muted">
          <span className="uppercase">Odds:</span>
          {game.odds.favoriteAbbr ? (
            <span>
              {game.odds.favoriteAbbr} {game.odds.spread}
            </span>
          ) : (
            game.odds.details && <span>{game.odds.details}</span>
          )}
          {game.odds.overUnder != null && (
            <>
              <span className="opacity-50">|</span>
              <span>O/U {game.odds.overUnder}</span>
            </>
          )}
          {game.odds.provider && <span className="italic opacity-70">({game.odds.provider})</span>}
        </div>
      )}
    </div>
  );
}
