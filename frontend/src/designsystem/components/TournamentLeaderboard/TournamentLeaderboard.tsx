import Avatar from '../Avatar';
import type { TournamentLeaderboardRow } from '../../../lib/types';
import type { ResultShade } from '../../../lib/wcGamesView';
import { SHADE_TINT } from '../WorldCupBrowse/resultShade';

export interface TournamentLeaderboardProps {
  /**
   * Leaderboard rows, already ordered by the backend's tiebreaker comparator.
   * TournamentLeaderboard never fetches and never re-sorts — it renders rows in
   * the supplied order so the displayed ranking matches the API's authoritative
   * tiebreaker resolution (see world-cup-picks-rules.md).
   */
  rows: TournamentLeaderboardRow[];
  /**
   * When true (knockout-only pool), the two draw columns (Draws Correct and
   * Draws Incorrect) are hidden — no draw outcomes exist in knockout play.
   * Defaults to false so regular World Cup groups still show draw stats.
   */
  knockoutOnly?: boolean;
}

const HEADER_CELL = 'px-sm py-xs text-left text-xs font-semibold uppercase tracking-wide text-secondary-500 dark:text-secondary-400';
const BODY_CELL = 'px-sm py-xs align-middle text-sm text-secondary-900 dark:text-neutral-0 border-t border-secondary-200 dark:border-secondary-700';

// The numeric tiebreaker fields, restricted to exactly the four stat keys so a
// column can never point at a non-numeric field (name/pictureUrl/…). This keeps
// `row[col.key]` strongly typed as `number` — no casts — and makes a future
// typo a compile error.
type StatKey = 'wins_correct' | 'losses' | 'draws_correct' | 'draws_incorrect';

// The four tiebreaker stats, in tiebreaker order. Shared between the desktop
// table columns and the mobile stat-chip grid so the two layouts can never
// drift out of sync. `key` indexes the row; `label` is the human-facing header.
// `shade` maps each stat onto the picks-view result palette (win/draw/partial/
// loss) so the mobile chips read with the same colour coding as a scored game.
const STAT_COLUMNS: { key: StatKey; label: string; short: string; shade: ResultShade }[] = [
  { key: 'wins_correct', label: 'Wins Correct', short: 'Wins', shade: 'win' },
  { key: 'losses', label: 'Losses', short: 'Losses', shade: 'loss' },
  { key: 'draws_correct', label: 'Draws Correct', short: 'D ✓', shade: 'draw' },
  { key: 'draws_incorrect', label: 'Draws Incorrect', short: 'D ✗', shade: 'partial' },
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
 *
 * When `knockoutOnly` is true (knockout-only pool), the two draw columns are
 * hidden since knockout matches cannot end in a draw. The Bonus column is
 * always shown for World Cup groups.
 */
export default function TournamentLeaderboard({ rows, knockoutOnly = false }: TournamentLeaderboardProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-secondary-500 dark:text-secondary-400 py-lg text-center">
        {EMPTY_STATE}
      </p>
    );
  }

  // Filter stat columns for the mobile chip grid: drop draws when knockoutOnly.
  const visibleStatColumns = knockoutOnly
    ? STAT_COLUMNS.filter((col) => col.key !== 'draws_correct' && col.key !== 'draws_incorrect')
    : STAT_COLUMNS;

  return (
    <>
      {/* Mobile (below sm): card-free stacked list with a stat-chip grid. */}
      <ul className="sm:hidden divide-y divide-secondary-200 dark:divide-secondary-700">
        {rows.map((row, index) => (
          <li key={row.userId} className="py-md">
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
              {visibleStatColumns.map((col) => (
                <div
                  key={col.key}
                  style={SHADE_TINT[col.shade]}
                  className="rounded-base border px-xs py-xs text-center"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-secondary-500 dark:text-secondary-400">
                    {col.short}
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-secondary-900 dark:text-neutral-0">
                    {row[col.key]}
                  </div>
                </div>
              ))}
              <div
                className="rounded-base border px-xs py-xs text-center"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-secondary-500 dark:text-secondary-400">
                  Bonus
                </div>
                <div className="text-sm font-semibold tabular-nums text-secondary-900 dark:text-neutral-0">
                  {row.bonus_points}
                </div>
              </div>
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
              {STAT_COLUMNS.map((col) => {
                if ((col.key === 'draws_correct' || col.key === 'draws_incorrect') && knockoutOnly) {
                  return null;
                }
                return (
                  <th key={col.key} scope="col" className={`${HEADER_CELL} text-center`}>
                    {col.label}
                  </th>
                );
              })}
              <th scope="col" className={`${HEADER_CELL} text-center`}>
                Bonus
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.userId}>
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
                {STAT_COLUMNS.map((col) => {
                  if ((col.key === 'draws_correct' || col.key === 'draws_incorrect') && knockoutOnly) {
                    return null;
                  }
                  return (
                    <td key={col.key} className={`${BODY_CELL} text-center tabular-nums`}>
                      {row[col.key]}
                    </td>
                  );
                })}
                <td className={`${BODY_CELL} text-center tabular-nums`}>
                  {row.bonus_points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
