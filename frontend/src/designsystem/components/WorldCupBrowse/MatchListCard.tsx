import type { BrowseGame, MatchResult } from '../../../lib/wcGamesView';
import { isLocked, liveClockLabel, outcomeOf, resultShade, teamsDecided } from '../../../lib/wcGamesView';
import ChoiceButton from './ChoiceButton';
import { SHADE_TINT } from './resultShade';

export interface MatchListCardProps {
  game: BrowseGame;
  now: Date;
  onPick: (gameId: number, result: MatchResult) => void;
  /** Opens the match detail panel for this game. Omit to hide the "More ›" button. */
  onOpenDetail?: (gameId: number) => void;
  disabled?: boolean;
  /** Callback fired when the user changes a score prediction. Knockout matches only. */
  onScoreChange?: (gameId: number, side: 'home' | 'away', value: number | null) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Locked games (live/final) show the score + the viewer's pick outcome, not buttons.
 *  Final games are tinted by how the pick fared (win/draw/partial/loss). */
function ResultStrip({ game }: { game: BrowseGame }) {
  const live = game.status === 'IN_PROGRESS';
  const result = outcomeOf(game);
  const pickedTeam =
    game.picked === 'home' ? game.home.abbr : game.picked === 'away' ? game.away.abbr : game.picked === 'draw' ? 'Draw' : null;
  // Only final matches carry a settled result to shade by; live stays neutral.
  const shade = game.status === 'FINAL' ? resultShade(game.picked, result) : null;

  return (
    <div
      style={shade ? SHADE_TINT[shade] : undefined}
      className="rounded-xl border border-border bg-neutral-0 p-sm shadow-sm dark:bg-secondary-800"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-xs text-sm font-bold text-content">
          <img src={game.home.logo} alt="" className="h-5 w-5 object-contain" /> {game.home.abbr}
        </span>
        <span className="text-xl font-extrabold tabular-nums text-content">
          {game.homeScore} <span className="text-content-subtle">–</span> {game.awayScore}
        </span>
        <span className="flex items-center gap-xs text-sm font-bold text-content">
          {game.away.abbr} <img src={game.away.logo} alt="" className="h-5 w-5 object-contain" />
        </span>
      </div>
      <div className="mt-xs flex items-center justify-center gap-xs text-xs">
        {pickedTeam == null ? (
          <span className="text-content-subtle">No pick made</span>
        ) : (
          <>
            <span className="text-content-subtle">Your pick:</span>
            <span className="font-semibold text-content">{pickedTeam}</span>
            {!live && shade && (
              <span
                className="font-bold"
                style={{ color: shade === 'win' || shade === 'draw' ? '#0c8772' : shade === 'partial' ? '#f97316' : '#ef4444' }}
              >
                {shade === 'win' ? '✓ +3' : shade === 'draw' ? '✓ +2' : shade === 'partial' ? '~ +1' : '✗ 0'}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * One game in the World Cup browse list. A subheader shows the time/status and
 * full team names; the card body is the three-way bet (pickable) or a result
 * strip (locked).
 */
export default function MatchListCard({ game, now, onPick, onOpenDetail, disabled, onScoreChange }: MatchListCardProps) {
  const locked = isLocked(game, now);
  const lead =
    game.status === 'IN_PROGRESS' ? 'LIVE' : game.status === 'FINAL' ? 'FINAL' : formatTime(game.kickoff);
  // Minute mark for a live match ("63'" / "HT"); null otherwise. Shown next to
  // the LIVE badge so the card hints at how far along the game is.
  const clock = liveClockLabel(game);

  // Knockout slots are scheduled with placeholders before participants are
  // known; no outcome is pickable until both teams are decided. Shares the
  // exact rule the "needs pick" filter uses so the card and the filter can't
  // disagree. And a knockout can't end in a draw (PKs decide), so the Draw
  // choice isn't offered at all there — only the two teams.
  const teamsAssigned = teamsDecided(game);

  return (
    <div data-testid={`match-card-${game.id}`}>
      {/* subheader: status/time + full names (wraps), roomy More on the right */}
      <div className="flex items-start justify-between gap-sm px-xxs pb-xxs pt-sm">
        <div className="min-w-0 text-xs leading-snug">
          <span className={`font-bold uppercase tracking-wide ${game.status === 'IN_PROGRESS' ? 'text-error-500' : 'text-content-subtle'}`}>
            {lead}
          </span>
          {clock && (
            <span className="ml-xs font-bold tabular-nums text-error-500" data-testid={`match-clock-${game.id}`}>
              {clock}
            </span>
          )}
          <span className="ml-xs font-semibold text-content-muted">
            {game.home.name} <span className="text-content-subtle">vs</span> {game.away.name}
          </span>
        </div>
        {onOpenDetail && (
          <button
            type="button"
            onClick={() => onOpenDetail(game.id)}
            className="shrink-0 rounded-md px-xs py-xxs text-sm font-semibold text-accent hover:bg-accent-subtle/50"
          >
            More ›
          </button>
        )}
      </div>

      {locked ? (
        <ResultStrip game={game} />
      ) : (
        <div className="rounded-xl border border-border bg-neutral-0 p-sm shadow-sm dark:bg-secondary-800">
          <div className="flex gap-xs">
            <ChoiceButton team={game.home} odds={game.home.moneyline} record={game.home.record} selected={game.picked === 'home'} onClick={() => onPick(game.id, 'home')} disabled={disabled || !teamsAssigned} />
            {/* Group games are three-way (Draw is a valid outcome). Knockout games
                are single-elimination — PKs decide a level match — so only the two
                teams are offered; Draw isn't rendered at all. */}
            {!game.isKnockout && (
              <ChoiceButton odds={game.drawOdds} selected={game.picked === 'draw'} onClick={() => onPick(game.id, 'draw')} disabled={disabled || !teamsAssigned} />
            )}
            <ChoiceButton team={game.away} odds={game.away.moneyline} record={game.away.record} selected={game.picked === 'away'} onClick={() => onPick(game.id, 'away')} disabled={disabled || !teamsAssigned} />
          </div>

          {/* Score prediction inputs — editable knockout matches only.
              `step="any"` prevents native browser validation from blocking submit;
              bounds ([0, 20]) are enforced server-side. Hidden for group-stage. */}
          {game.isKnockout && onScoreChange && (
            <div className="mt-sm flex items-center gap-sm border-t border-border pt-sm" aria-label="Predict the score">
              <span className="text-xs text-content-muted">Predicted score:</span>
              <div className="flex items-center gap-xs">
                <label className="flex items-center gap-xxs text-xs">
                  <span className="font-medium">{game.home.abbr}</span>
                  <input
                    type="number"
                    step="any"
                    aria-label={`Predicted score for ${game.home.name}`}
                    value={game.predictedHomeScore ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      onScoreChange(game.id, 'home', raw === '' ? null : Number(raw));
                    }}
                    className="w-12 rounded border border-border bg-surface px-xs py-xxxs text-center text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </label>
                <span className="text-xs text-content-muted">–</span>
                <label className="flex items-center gap-xxs text-xs">
                  <span className="font-medium">{game.away.abbr}</span>
                  <input
                    type="number"
                    step="any"
                    aria-label={`Predicted score for ${game.away.name}`}
                    value={game.predictedAwayScore ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      onScoreChange(game.id, 'away', raw === '' ? null : Number(raw));
                    }}
                    className="w-12 rounded border border-border bg-surface px-xs py-xxxs text-center text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
