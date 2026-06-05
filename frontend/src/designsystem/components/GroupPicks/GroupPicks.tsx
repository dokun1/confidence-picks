import Avatar from '../Avatar';
import Button from '../Button';
import type { GameData, GroupMember, MemberPicks, PickData } from '../../../lib/types';

export interface GroupPicksProps {
  /** Games for the week, rendered one per row in date/display order as received. */
  games: GameData[];
  /** Per-member picks for the week. Each entry associates a member id with their PickData[]. */
  picks: MemberPicks[];
  /** Group members, rendered one per column with an Avatar header. */
  members: GroupMember[];
  /**
   * Optional refresh action. When provided, a Refresh button is shown in the header.
   * GroupPicks never fetches — the parent owns the data and re-supplies `picks`.
   */
  onRefresh?: () => void;
}

/**
 * Visibility states for a single member/game cell.
 *
 * Mirrors the owner-vs-member visibility rules from the Svelte source (presentational
 * layer only): a member's pick is withheld from other viewers until the game starts,
 * so SCHEDULED games always render a placeholder regardless of the underlying data.
 */
type CellState = 'withheld' | 'nopick' | 'revealed' | 'result';

/** True once a game has kicked off (in progress or final) — picks are no longer hidden. */
function hasStarted(game: GameData): boolean {
  return game.status !== 'SCHEDULED';
}

/** A pick counts as submitted only when both a team and a confidence value are set. */
function isComplete(pick: PickData | undefined): pick is PickData {
  return !!pick && pick.pickedTeamId != null && pick.confidence != null;
}

function cellState(game: GameData, pick: PickData | undefined): CellState {
  // Withheld until kickoff so members cannot copy each other's picks.
  if (!hasStarted(game)) return 'withheld';
  if (!isComplete(pick)) return 'nopick';
  if (game.status === 'FINAL') return 'result';
  return 'revealed';
}

/** Resolve the picked team to the matching home/away TeamData on the game. */
function pickedTeam(game: GameData, pick: PickData) {
  if (pick.pickedTeamId === game.homeTeam.id) return game.homeTeam;
  if (pick.pickedTeamId === game.awayTeam.id) return game.awayTeam;
  return null;
}

type Outcome = 'won' | 'lost' | 'neutral';

// Keyed class records instead of inline ternaries — mirrors Button.tsx / Navigation.tsx.
const RESULT_CLASSES: Record<Outcome, string> = {
  won: 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300',
  lost: 'bg-error-100 text-error-700 dark:bg-error-900 dark:text-error-300',
  neutral: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-300',
};

function outcomeOf(pick: PickData): Outcome {
  if (pick.won === true) return 'won';
  if (pick.won === false) return 'lost';
  return 'neutral';
}

/** Per-game aggregate across members, shown once a game is FINAL. */
function rowCorrectness(game: GameData, picksByMember: Map<string, Map<number, PickData>>, members: GroupMember[]) {
  let correct = 0;
  let graded = 0;
  for (const member of members) {
    const pick = picksByMember.get(member.id)?.get(game.id);
    if (!isComplete(pick) || pick.won == null) continue;
    graded += 1;
    if (pick.won === true) correct += 1;
  }
  return { correct, graded };
}

const HEADER_CELL = 'px-sm py-xs text-left text-xs font-semibold uppercase tracking-wide text-secondary-500 dark:text-secondary-400';
const BODY_CELL = 'px-sm py-xs align-top text-sm text-secondary-900 dark:text-neutral-0 border-t border-secondary-200 dark:border-secondary-700';
const PLACEHOLDER = 'text-secondary-400 dark:text-secondary-500 italic';

/**
 * GroupPicks renders a read-only matrix of a group's weekly confidence picks:
 * one row per game, one column per member, plus a per-game correctness summary
 * once results are final.
 *
 * It is a pure presentation component — it never fetches. The parent supplies
 * `games`, `picks` (member-keyed), and `members`. Visibility mirrors the Svelte
 * source: a member's pick is hidden behind a placeholder while the game is still
 * SCHEDULED (withheld), or once started if that member never submitted; revealed
 * picks show the chosen team and confidence; FINAL games additionally show points
 * and correctness. Composes Avatar (column headers) and Button (header actions).
 */
export default function GroupPicks({ games, picks, members, onRefresh }: GroupPicksProps) {
  // member id -> (game id -> pick) for O(1) cell lookups.
  const picksByMember = new Map<string, Map<number, PickData>>();
  for (const entry of picks) {
    const byGame = new Map<number, PickData>();
    for (const pick of entry.picks) byGame.set(pick.gameId, pick);
    picksByMember.set(entry.memberId, byGame);
  }

  const hasFinal = games.some(game => game.status === 'FINAL');

  return (
    <div className="space-y-md">
      {/* Header */}
      <div className="flex items-center justify-between gap-sm">
        <h2 className="text-lg font-heading font-semibold text-secondary-900 dark:text-neutral-0">
          Group Picks
        </h2>
        {onRefresh && (
          <Button variant="tertiary" size="sm" onClick={onRefresh}>
            Refresh
          </Button>
        )}
      </div>

      {games.length === 0 || members.length === 0 ? (
        <p className="text-sm text-secondary-500 dark:text-secondary-400 py-lg text-center">
          {games.length === 0 ? 'No games available for this week.' : 'No members to display.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-secondary-200 dark:border-secondary-700">
          <table className="min-w-full border-collapse bg-neutral-0 dark:bg-secondary-900">
            <thead>
              <tr className="bg-secondary-50 dark:bg-secondary-800">
                <th scope="col" className={HEADER_CELL}>
                  Game
                </th>
                {members.map(member => (
                  <th key={member.id} scope="col" className={`${HEADER_CELL} text-center`}>
                    <div className="flex flex-col items-center gap-xxs">
                      <Avatar
                        name={member.name}
                        email={member.email}
                        pictureUrl={member.pictureUrl}
                        variant="md"
                      />
                      <span className="font-medium text-secondary-700 dark:text-secondary-300 normal-case">
                        {member.name || member.email}
                      </span>
                    </div>
                  </th>
                ))}
                {hasFinal && (
                  <th scope="col" className={`${HEADER_CELL} text-center`}>
                    Correct
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {games.map(game => {
                const { correct, graded } = rowCorrectness(game, picksByMember, members);
                return (
                  <tr key={game.id}>
                    <th scope="row" className={`${BODY_CELL} text-left font-medium whitespace-nowrap`}>
                      <span className="block">
                        {game.awayTeam.abbreviation} @ {game.homeTeam.abbreviation}
                      </span>
                      <span className="block text-xs font-normal text-secondary-500 dark:text-secondary-400">
                        {game.status === 'FINAL'
                          ? `Final ${game.awayScore}-${game.homeScore}`
                          : game.status === 'IN_PROGRESS'
                            ? game.statusDetail || 'In progress'
                            : 'Scheduled'}
                      </span>
                    </th>

                    {members.map(member => {
                      const pick = picksByMember.get(member.id)?.get(game.id);
                      const state = cellState(game, pick);
                      return (
                        <td key={member.id} className={`${BODY_CELL} text-center`}>
                          {renderCell(game, pick, state)}
                        </td>
                      );
                    })}

                    {hasFinal && (
                      <td className={`${BODY_CELL} text-center font-medium`}>
                        {game.status === 'FINAL' ? (
                          <span className="text-secondary-700 dark:text-secondary-300">
                            {correct}/{graded}
                          </span>
                        ) : (
                          <span className={PLACEHOLDER}>—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Render a single matrix cell for the given visibility state. */
function renderCell(game: GameData, pick: PickData | undefined, state: CellState) {
  if (state === 'withheld') {
    return <span className={PLACEHOLDER} title="Hidden until kickoff">Hidden</span>;
  }
  if (state === 'nopick') {
    return <span className={PLACEHOLDER}>No pick</span>;
  }

  // 'revealed' and 'result' both have a complete pick.
  const completePick = pick as PickData;
  const team = pickedTeam(game, completePick);
  const teamLabel = team?.abbreviation ?? '—';

  if (state === 'result') {
    const outcome = outcomeOf(completePick);
    const points = completePick.points ?? completePick.confidence ?? 0;
    return (
      <span
        className={`inline-flex items-center gap-xxs px-xs py-xxxs rounded-base text-sm font-medium ${RESULT_CLASSES[outcome]}`}
        title={outcome === 'won' ? `Won ${points}` : outcome === 'lost' ? `Lost ${points}` : 'Push'}
      >
        <span>{teamLabel}</span>
        <span className="font-semibold">{points}</span>
      </span>
    );
  }

  // 'revealed' — in-progress pick visible but not yet graded.
  return (
    <span className="inline-flex items-center gap-xxs">
      <span className="font-medium">{teamLabel}</span>
      <span className="text-xs text-secondary-500 dark:text-secondary-400">({completePick.confidence})</span>
    </span>
  );
}
