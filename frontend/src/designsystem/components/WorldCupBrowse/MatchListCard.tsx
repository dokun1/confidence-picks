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
        <>
          <ResultStrip game={game} />
          {/* Read-only prediction: shown when kickoff has passed and the user had
              saved a score prediction for this knockout match. Mirrors MatchPickRow. */}
          {game.isKnockout && (game.predictedHomeScore != null || game.predictedAwayScore != null) && (
            <div className="mt-xs flex items-center justify-center gap-xs text-xs text-content-muted" data-testid={`prediction-${game.id}`}>
              <span>Your prediction:</span>
              <span className="font-semibold tabular-nums">
                {game.home.abbr} {game.predictedHomeScore ?? '–'} – {game.predictedAwayScore ?? '–'} {game.away.abbr}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-border bg-neutral-0 p-sm shadow-sm dark:bg-secondary-800">
          {(() => {
            const homeVal = game.predictedHomeScore;
            const awayVal = game.predictedAwayScore;
            const homeFilled = homeVal != null && !isNaN(homeVal);
            const awayFilled = awayVal != null && !isNaN(awayVal);
            // The score is an OPTIONAL bonus that can only be added once the game is
            // picked — you can pick (and earn the 3 base points) without a score.
            const picked = game.picked === 'home' || game.picked === 'away';
            const oneSided = game.isKnockout && !!onScoreChange && picked && homeFilled !== awayFilled;

            // Digits-only text field (no steppers): only non-negative integers are
            // accepted, and an empty field means "no prediction" (default null). The
            // field is disabled until a team is picked AND whenever the card is
            // disabled (e.g. a submit in flight), matching the pick buttons; a bonus
            // is registered only when BOTH are present (enforced on submit).
            const scoreInput = (side: 'home' | 'away', val: number | null | undefined, teamName: string) => (
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                disabled={!picked || disabled}
                aria-label={`Predicted score for ${teamName}`}
                value={val == null ? '' : String(val)}
                placeholder="–"
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, '');
                  onScoreChange!(game.id, side, digits === '' ? null : Number(digits));
                }}
                className="h-9 w-9 rounded border border-border bg-surface text-center text-base font-semibold tabular-nums focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-40"
              />
            );

            return (
              <>
                {/* One horizontal row of three equal-width slots: home pick ·
                    middle · away pick. In group games the middle slot is the
                    Draw choice; in knockout games (no Draw) it holds the two
                    optional score fields, centered. Keeping the middle slot
                    flex-1 (not shrink-to-fit) means the team buttons stay the
                    same width as a three-way pick instead of stretching to
                    swallow the leftover space. */}
                <div className="flex items-center gap-xs">
                  <ChoiceButton team={game.home} odds={game.home.moneyline} record={game.home.record} selected={game.picked === 'home'} onClick={() => onPick(game.id, 'home')} disabled={disabled || !teamsAssigned} />
                  {!game.isKnockout ? (
                    <ChoiceButton odds={game.drawOdds} selected={game.picked === 'draw'} onClick={() => onPick(game.id, 'draw')} disabled={disabled || !teamsAssigned} />
                  ) : onScoreChange ? (
                    <div
                      className="flex flex-1 items-center justify-center gap-xxs"
                      aria-label="Predict the score (optional)"
                      title={picked ? 'Optional: predict the score for bonus points' : 'Pick a team first to predict the score'}
                    >
                      {scoreInput('home', homeVal, game.home.name)}
                      <span className={picked ? 'text-content-subtle' : 'text-content-subtle/40'}>–</span>
                      {scoreInput('away', awayVal, game.away.name)}
                    </div>
                  ) : null}
                  <ChoiceButton team={game.away} odds={game.away.moneyline} record={game.away.record} selected={game.picked === 'away'} onClick={() => onPick(game.id, 'away')} disabled={disabled || !teamsAssigned} />
                </div>
                {/* Both-or-neither hint: shown when exactly one score is filled. */}
                {oneSided && (
                  <p className="mt-xs text-center text-xs text-warning-700 dark:text-warning-400" data-testid={`score-hint-${game.id}`}>
                    Enter both scores to earn the bonus
                  </p>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
