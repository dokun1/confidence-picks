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

// The four tiebreaker stats, in tiebreaker order. Shared between the desktop
// table columns and the mobile stat-chip grid so the two layouts can never
// drift out of sync. `key` indexes the row; `label` is the human-facing header.
const STAT_COLUMNS: { key: keyof TournamentLeaderboardRow; label: string; short: string }[] = [
  { key: 'wins_correct', label: 'Wins Correct', short: 'Wins' },
  { key: 'losses', label: 'Losses', short: 'Losses' },
  { key: 'draws_correct', label: 'Draws Correct', short: 'D ✓' },
  { key: 'draws_incorrect', label: 'Draws Incorrect', short: 'D ✗' },
];

const EMPTY_STATE = 'No standings yet — picks will appear here once the tournament begins.';

/**
 * TournamentLeaderboard renders a World Cup pool's standings: one row per member,
 * with total points plus the four tiebreaker columns in tiebreaker order
 * (wins correct, losses, draws correct, draws incorrect).
 *
 * It is a pure presentation component — it never fetches. The parent supplies
 * `rows` already ordered by the backend comparator; this component renders them
 * in that order without re-sorting. Composes Avatar for member identity.
 *
 * Two layouts, switched purely with Tailwind responsive utilities (no JS / no
 * window measurement, so it's SSR- and test-stable):
 *  - `sm` and up: the bordered standings table (unchanged from before).
 *  - below `sm`: a card-free stacked list — each member is a row with rank +
 *    avatar + name + emphasized points, and the four tiebreakers below as a
 *    4-up stat-chip grid. No bordered card and no horizontal scroll on phones.
 */
export default function TournamentLeaderboard({ rows }: TournamentLeaderboardProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-secondary-500 dark:text-secondary-400 py-lg text-center">
        {EMPTY_STATE}
      </p>
    );
  }

  return (
    <>
      {/* Mobile (below sm): card-free stacked list with a stat-chip grid. */}
      <ul className="sm:hidden divide-y divide-secondary-200 dark:divide-secondary-700">
        {rows.map((row, index) => (
          <li key={row.memberId} className="py-md">
            <div className="flex items-center gap-sm">
              <span className="w-6 shrink-0 text-center text-sm font-medium text-secondary-500 dark:text-secondary-400 tabular-nums">
                {index + 1}
              </span>
              <Avatar name={row.name} pictureUrl={row.pictureUrl} variant="md" />
              <span className="min-w-0 flex-1 truncate font-medium text-secondary-900 dark:text-neutral-0">
                {row.name}
              </span>
              <span className="shrink-0 text-right leading-none">
                <span className="block text-lg font-semibold tabular-nums text-secondary-900 dark:text-neutral-0">
                  {row.points}
                </span>
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-secondary-500 dark:text-secondary-400">
                  pts
                </span>
              </span>
            </div>
            <div className="mt-sm grid grid-cols-4 gap-xs">
              {STAT_COLUMNS.map((col) => (
                <div
                  key={col.key}
                  className="rounded-base bg-secondary-50 dark:bg-secondary-800 px-xs py-xs text-center"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-secondary-500 dark:text-secondary-400">
                    {col.short}
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-secondary-900 dark:text-neutral-0">
                    {row[col.key] as number}
                  </div>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop (sm and up): the bordered standings table. */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-secondary-200 dark:border-secondary-700">
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
              {STAT_COLUMNS.map((col) => (
                <th key={col.key} scope="col" className={`${HEADER_CELL} text-center`}>
                  {col.label}
                </th>
              ))}
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
                    <Avatar name={row.name} pictureUrl={row.pictureUrl} variant="md" />
                    <span>{row.name}</span>
                  </div>
                </th>
                <td className={`${BODY_CELL} text-center font-semibold tabular-nums`}>
                  {row.points}
                </td>
                {STAT_COLUMNS.map((col) => (
                  <td key={col.key} className={`${BODY_CELL} text-center tabular-nums`}>
                    {row[col.key] as number}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
