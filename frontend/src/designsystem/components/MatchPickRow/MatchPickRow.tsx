import Button from '../Button';
import MatchTimeline from '../MatchTimeline';
import { hasBothTeamsAssigned } from '../../../lib/teamUtils';
import type { MatchPickResult, TeamData, WorldCupMatch } from '../../../lib/types';

// Soccer sibling of GamePickRow. A World Cup pick is one of three outcomes —
// Home / Draw / Away — with NO confidence selector (World Cup scoring is
// flat-per-match). The Draw button is disabled for knockout matches, where a
// match always resolves to an advancing team (see world-cup-picks-rules.md),
// and every outcome is disabled until both slots hold real teams (knockout
// fixtures are scheduled with TBD placeholders before participants are known).
// This row is presentational: it surfaces the three choices and emits intent
// up via `onPick`. The parent owns the draft and persistence; the row never
// fetches.

export interface MatchPickRowProps {
  /** The match to render. */
  match: WorldCupMatch;
  /** The currently selected outcome for this match, or null when unpicked. */
  pickedResult: MatchPickResult | null;
  /** Emits the chosen outcome. The parent owns the draft. */
  onPick: (result: MatchPickResult) => void;
  /** Page-level disable (no editable window, or a submit is in flight). */
  disabled?: boolean;
}

/** Map the backend status enum to a human label, matching GamePickRow. */
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

/** Human label per stage for the header badge. */
const STAGE_LABEL: Record<WorldCupMatch['stage'], string> = {
  group: 'Group Stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarterfinal',
  sf: 'Semifinal',
  third: 'Third Place',
  final: 'Final',
};

const STATUS_BADGE: Record<ReturnType<typeof deriveStatus>, string> = {
  final: 'bg-success-600 text-neutral-0',
  'in progress': 'bg-error-600 text-neutral-0',
  'not started': 'bg-secondary-200 text-secondary-700 dark:bg-secondary-700 dark:text-secondary-200',
};

function formatGameDate(dateString?: string): string | null {
  if (!dateString) return null;
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MatchPickRow({
  match,
  pickedResult,
  onPick,
  disabled = false,
}: MatchPickRowProps) {
  const status = deriveStatus(match.status);
  // A pick locks at kickoff and STAYS locked. We key off the scheduled kickoff
  // time (match.gameDate), not just match.status: ESPN occasionally serves a
  // stale pre-kickoff snapshot mid-match that flaps status back to SCHEDULED,
  // and a status-only lock would briefly re-open an in-progress match's pick.
  // The kickoff timestamp is stable, so once it passes the row stays locked no
  // matter how status flaps. The backend enforces the same kickoff rule.
  const kickoffPassed =
    match.gameDate != null && new Date(match.gameDate).getTime() <= Date.now();
  const locked = status !== 'not started' || kickoffPassed;
  // Knockout fixtures appear in the schedule before their participants are
  // decided; until both slots hold real teams there is nothing to pick.
  const teamsAssigned = hasBothTeamsAssigned(match);
  const editable = !locked && !disabled && teamsAssigned;
  const dateLabel = formatGameDate(match.gameDate);

  function pickButton(result: MatchPickResult, label: string, ariaLabel: string, extraDisabled = false) {
    const selected = pickedResult === result;
    return (
      <Button
        variant={selected ? 'primary' : 'secondary'}
        size="md"
        disabled={!editable || extraDisabled}
        aria-pressed={selected}
        aria-label={ariaLabel}
        onClick={() => onPick(result)}
        className="flex-1"
      >
        {label}
      </Button>
    );
  }

  const homeLabel = match.homeTeam.abbreviation || match.homeTeam.name;
  const awayLabel = match.awayTeam.abbreviation || match.awayTeam.name;

  return (
    <div
      id={`match-row-${match.id}`}
      data-testid={`match-row-${match.id}`}
      className="flex flex-col gap-sm rounded-md border border-border bg-surface p-sm shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-border pb-xs">
        <span className="text-xs text-content-muted">
          {dateLabel ?? STAGE_LABEL[match.stage]}
        </span>
        <div className="flex items-center gap-xs">
          <span className="rounded px-xs py-xxxs text-[0.6rem] font-semibold uppercase tracking-wide bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-200">
            {STAGE_LABEL[match.stage]}
          </span>
          <span
            className={`rounded px-xs py-xxxs text-[0.6rem] font-semibold uppercase tracking-wide ${STATUS_BADGE[status]}`}
          >
            {status}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-sm py-xs">
        <TeamLabel team={match.homeTeam} score={match.homeScore} showScore={locked} />
        <span className="text-xs font-semibold uppercase text-content-muted">vs</span>
        <TeamLabel team={match.awayTeam} score={match.awayScore} showScore={locked} align="right" />
      </div>

      {locked && match.events && match.events.length > 0 && (
        <div className="border-t border-border pt-xs">
          <MatchTimeline events={match.events} />
        </div>
      )}

      <div className="flex items-stretch gap-xs" role="group" aria-label="Select match result">
        {pickButton('home', homeLabel, `Pick ${match.homeTeam.name} to win`)}
        {pickButton('draw', 'Draw', 'Pick a draw', match.isKnockout)}
        {pickButton('away', awayLabel, `Pick ${match.awayTeam.name} to win`)}
      </div>
    </div>
  );
}

function TeamLabel({
  team,
  score,
  showScore,
  align = 'left',
}: {
  team: TeamData;
  score: number;
  showScore: boolean;
  align?: 'left' | 'right';
}) {
  return (
    <span
      className={[
        'flex flex-1 items-center gap-xs',
        align === 'right' ? 'flex-row-reverse text-right' : '',
      ].join(' ')}
    >
      {team.logo && <img className="h-8 w-8 object-contain" alt={team.abbreviation} src={team.logo} />}
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">{team.abbreviation}</span>
        <span className="text-[0.6rem] uppercase tracking-wide text-content-muted">{team.name}</span>
      </span>
      {showScore && (
        <span className="min-w-[2ch] text-lg font-bold tabular-nums">{score ?? 0}</span>
      )}
    </span>
  );
}
