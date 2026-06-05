import Avatar from '../Avatar';
import type { TournamentLeaderboardRow } from '../../../lib/types';

export interface TournamentLeaderboardProps {
  /**
   * Leaderboard rows, already ordered by the backend's tiebreaker comparator.
   * TournamentLeaderboard never fetches and never re-sorts — it renders rows in
   * the supplied order so the displayed ranking matches the API's authoritative
   * tiebreaker resolution (see world-cup-picks-rules.md).
   */
  rows: TournamentLeaderboardRow[];
}

const HEADER_CELL = 'px-sm py-xs text-left text-xs font-semibold uppercase tracking-wide text-secondary-500 dark:text-secondary-400';
const BODY_CELL = 'px-sm py-xs align-middle text-sm text-secondary-900 dark:text-neutral-0 border-t border-secondary-200 dark:border-secondary-700';

/**
 * TournamentLeaderboard renders a World Cup pool's standings: one row per member,
 * with total points plus the four tiebreaker columns in tiebreaker order
 * (wins correct, losses, draws correct, draws incorrect).
 *
 * It is a pure presentation component — it never fetches. The parent supplies
 * `rows` already ordered by the backend comparator; this component renders them
 * in that order without re-sorting. Composes Avatar for member identity.
 */
export default function TournamentLeaderboard({ rows }: TournamentLeaderboardProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-secondary-500 dark:text-secondary-400 py-lg text-center">
        No standings yet — picks will appear here once the tournament begins.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-secondary-200 dark:border-secondary-700">
      <table className="min-w-full border-collapse bg-neutral-0 dark:bg-secondary-900">
        <thead>
          <tr className="bg-secondary-50 dark:bg-secondary-800">
            <th scope="col" className={`${HEADER_CELL} text-center`}>
              #
            </th>
            <th scope="col" className={HEADER_CELL}>
              Member
            </th>
            <th scope="col" className={`${HEADER_CELL} text-center`}>
              Points
            </th>
            <th scope="col" className={`${HEADER_CELL} text-center`}>
              Wins Correct
            </th>
            <th scope="col" className={`${HEADER_CELL} text-center`}>
              Losses
            </th>
            <th scope="col" className={`${HEADER_CELL} text-center`}>
              Draws Correct
            </th>
            <th scope="col" className={`${HEADER_CELL} text-center`}>
              Draws Incorrect
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.memberId}>
              <td className={`${BODY_CELL} text-center font-medium text-secondary-500 dark:text-secondary-400 tabular-nums`}>
                {index + 1}
              </td>
              <th scope="row" className={`${BODY_CELL} text-left font-medium`}>
                <div className="flex items-center gap-xs">
                  <Avatar name={row.name} variant="md" />
                  <span>{row.name}</span>
                </div>
              </th>
              <td className={`${BODY_CELL} text-center font-semibold tabular-nums`}>
                {row.points}
              </td>
              <td className={`${BODY_CELL} text-center tabular-nums`}>{row.wins_correct}</td>
              <td className={`${BODY_CELL} text-center tabular-nums`}>{row.losses}</td>
              <td className={`${BODY_CELL} text-center tabular-nums`}>{row.draws_correct}</td>
              <td className={`${BODY_CELL} text-center tabular-nums`}>{row.draws_incorrect}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
