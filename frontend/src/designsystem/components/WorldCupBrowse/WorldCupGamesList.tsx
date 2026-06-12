import { useMemo, useState } from 'react';
import type { WorldCupStage } from '../../../lib/types';
import {
  buildSections, needsPick, pickVerdict, NO_FILTERS,
  type BrowseGame, type Filters, type GameStatus, type MatchResult, type SavedView, type SortKey,
} from '../../../lib/wcGamesView';
import MatchListCard from './MatchListCard';

export interface WorldCupGamesListProps {
  games: BrowseGame[];          // derived by the host from matches + draft
  now: Date;
  onPick: (gameId: number, result: MatchResult) => void;
  disabled?: boolean;           // read-only viewer (optional; pass through if convenient)
}

const VIEWS: { key: SavedView; label: string }[] = [
  { key: 'needs-pick', label: 'Needs pick' },
  { key: 'today', label: 'Today' },
  { key: 'live', label: 'Live' },
  { key: 'all', label: 'All' },
  { key: 'correct', label: 'Correct' },
  { key: 'incorrect', label: 'Incorrect' },
];

const STAGES: { value: WorldCupStage | ''; label: string }[] = [
  { value: '', label: 'Any stage' },
  { value: 'group', label: 'Group' },
  { value: 'r32', label: 'Round of 32' },
  { value: 'r16', label: 'Round of 16' },
  { value: 'qf', label: 'Quarterfinals' },
  { value: 'sf', label: 'Semifinals' },
  { value: 'third', label: 'Third Place' },
  { value: 'final', label: 'Final' },
];

function Chip({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-xs whitespace-nowrap rounded-pill px-sm py-xxs text-sm font-semibold transition-colors ${
        active ? 'bg-accent text-accent-fg' : 'bg-secondary-100 text-content-muted hover:bg-secondary-200 dark:bg-secondary-800'
      }`}
    >
      {label}
      {count != null && (
        <span className={`rounded-pill px-xxs text-xs ${active ? 'bg-accent-fg/20' : 'bg-secondary-200 dark:bg-secondary-700'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

const selectCls =
  'rounded-md border border-border bg-neutral-0 px-xs py-xxs text-sm text-content dark:bg-secondary-900';

export default function WorldCupGamesList({ games, now, onPick, disabled }: WorldCupGamesListProps) {
  const [view, setView] = useState<SavedView>('needs-pick');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortKey>('kickoff');
  const [showFilters, setShowFilters] = useState(false);

  const needsPickCount = useMemo(() => games.filter((g) => needsPick(g, now)).length, [games, now]);
  const correctCount = useMemo(() => games.filter((g) => pickVerdict(g) === 'correct').length, [games]);
  const incorrectCount = useMemo(() => games.filter((g) => pickVerdict(g) === 'incorrect').length, [games]);
  // Counted chips: needs-pick + the running Correct/Incorrect tally (shown even at 0).
  const chipCount: Partial<Record<SavedView, number>> = {
    'needs-pick': needsPickCount,
    correct: correctCount,
    incorrect: incorrectCount,
  };
  const sections = useMemo(
    () => buildSections(games, { view, filters, query, sort, now }),
    [games, view, filters, query, sort, now],
  );

  const empty = sections.length === 0;

  return (
    <div className="mx-auto w-full max-w-[520px]">
      {/* header */}
      <div className="mb-sm flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-content">Picks</h1>
        {needsPickCount > 0 && <span className="text-sm font-semibold text-accent">{needsPickCount} left to pick</span>}
      </div>

      {/* search + filters toggle + sort */}
      <div className="mb-sm flex gap-xs">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teams…"
          className="flex-1 rounded-md border border-border bg-neutral-0 px-sm py-xxs text-sm text-content placeholder:text-content-subtle dark:bg-secondary-900"
        />
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          className={`rounded-md border px-sm py-xxs text-sm font-semibold ${
            showFilters ? 'border-accent text-accent' : 'border-border text-content-muted'
          }`}
        >
          Filters
        </button>
      </div>

      {/* saved-view chips */}
      <div className="mb-xs flex gap-xs overflow-x-auto pb-xxs">
        {VIEWS.map((v) => (
          <Chip
            key={v.key}
            label={v.label}
            count={chipCount[v.key]}
            active={view === v.key}
            onClick={() => setView(v.key)}
          />
        ))}
      </div>

      {/* filters row */}
      {showFilters && (
        <div className="mb-sm flex flex-wrap items-center gap-xs rounded-md border border-border bg-surface p-sm">
          <select
            className={selectCls}
            value={filters.stage ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, stage: (e.target.value || null) as WorldCupStage | null }))}
          >
            {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select
            className={selectCls}
            value={filters.status ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || null) as GameStatus | null }))}
          >
            <option value="">Any status</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="IN_PROGRESS">Live</option>
            <option value="FINAL">Final</option>
          </select>
          <select
            className={selectCls}
            value={filters.picked == null ? '' : filters.picked ? 'picked' : 'unpicked'}
            onChange={(e) =>
              setFilters((f) => ({ ...f, picked: e.target.value === '' ? null : e.target.value === 'picked' }))
            }
          >
            <option value="">Picked or not</option>
            <option value="unpicked">Unpicked</option>
            <option value="picked">Picked</option>
          </select>
          <select className={selectCls} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="kickoff">Sort: Kickoff</option>
            <option value="stage">Sort: Stage</option>
          </select>
        </div>
      )}

      {/* list */}
      {empty ? (
        <div className="rounded-xl border border-dashed border-border py-2xl text-center text-content-subtle">
          {view === 'needs-pick' ? 'All caught up — every game here is picked or locked. 🎉' : 'No games match these filters.'}
        </div>
      ) : (
        <div className="space-y-md">
          {sections.map((sec) => (
            <section key={sec.key}>
              <div className="pb-xxs text-sm font-bold uppercase tracking-wide text-content-subtle">
                {sec.label}{sec.stageLabel ? ` · ${sec.stageLabel}` : ''}
              </div>
              <div className="space-y-xs">
                {sec.games.map((g) => (
                  <MatchListCard key={g.id} game={g} now={now} onPick={onPick} disabled={disabled} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
