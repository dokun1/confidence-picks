import { useEffect, useMemo, useRef, useState } from 'react';
import type { WorldCupStage } from '../../../lib/types';
import {
  buildSections, needsPick, pickVerdict, NO_FILTERS,
  type BrowseGame, type Filters, type GameStatus, type MatchResult, type SavedView, type SortKey,
} from '../../../lib/wcGamesView';
import type { EventDetail } from '../../../lib/wcMatchDetail';
import { getMatchDetail } from '../../../lib/worldCupService.js';
import MatchListCard from './MatchListCard';
import MatchDetailPanel from './MatchDetailPanel';

// Fallback so the panel still renders the game-side info when the /event fetch fails.
const EMPTY_DETAIL: EventDetail = { venue: null, stats: [], lineups: null };

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
  const [view, setView] = useState<SavedView>('today');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortKey>('kickoff');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // Bumped on every open so a fast close/reopen can't let a stale fetch win.
  const fetchSeq = useRef(0);

  // The sticky controls block (search + chips + filters) and the results region
  // below it, measured so a filter change can re-anchor the scroll to content
  // rather than stranding the viewport in empty space — see the effect below.
  const headerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedGame = useMemo(
    () => (selectedId == null ? null : games.find((g) => g.id === selectedId) ?? null),
    [games, selectedId],
  );

  // If the selected game disappears from the list, drop the panel.
  useEffect(() => {
    if (selectedId != null && selectedGame == null) setSelectedId(null);
  }, [selectedId, selectedGame]);

  const openDetail = (gameId: number) => {
    const game = games.find((g) => g.id === gameId);
    if (!game) return;
    const seq = ++fetchSeq.current;
    setSelectedId(gameId);
    setDetail(null);
    setDetailLoading(true);
    getMatchDetail(game.espnId)
      .then((d: EventDetail) => {
        if (fetchSeq.current === seq) setDetail(d);
      })
      .catch(() => {
        if (fetchSeq.current === seq) setDetail(EMPTY_DETAIL);
      })
      .finally(() => {
        if (fetchSeq.current === seq) setDetailLoading(false);
      });
  };

  const closeDetail = () => {
    fetchSeq.current++; // invalidate any in-flight fetch
    setSelectedId(null);
    setDetail(null);
    setDetailLoading(false);
  };

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

  // Re-anchor the scroll on a filter change. The controls above are sticky, so a
  // change made while scrolled deep into the list would otherwise leave the
  // viewport stranded below the (possibly shorter) new results — staring at empty
  // space instead of matches. When the start of the list has scrolled up behind
  // the sticky controls, bring it back to just under them so the user lands on
  // content. We deliberately do NOT jump to the very top of the page on every
  // change: if the list start is still on screen, the scroll is left untouched.
  const filterKey = `${view}|${query}|${filters.stage ?? ''}|${filters.status ?? ''}|${
    filters.picked == null ? '' : filters.picked
  }|${sort}`;
  const prevFilterKey = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKey.current === filterKey) return; // initial mount — nothing changed
    prevFilterKey.current = filterKey;
    const list = listRef.current;
    if (!list) return;
    const headerH = headerRef.current?.offsetHeight ?? 0;
    // Only re-anchor when the list's top has scrolled up behind the sticky
    // controls; if it's still in view, the current scroll is already reasonable.
    if (list.getBoundingClientRect().top < headerH) {
      list.style.scrollMarginTop = `${headerH}px`;
      list.scrollIntoView({ block: 'start' });
    }
  }, [filterKey]);

  return (
    <div className="mx-auto w-full max-w-[520px]">
      {/* header */}
      <div className="mb-sm flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-content">Picks</h1>
        {needsPickCount > 0 && <span className="text-sm font-semibold text-accent">{needsPickCount} left to pick</span>}
      </div>

      {/* Sticky controls — search + view chips + filters stay pinned to the top
          of the viewport while the match list scrolls beneath them. The negative
          margins bleed the backdrop out to the host page gutters so list rows
          never show through the gap as they scroll under it; the matching px
          re-pads the inner controls back to the column. z-10 keeps it above the
          rows but below the detail panel (z-40). */}
      <div
        ref={headerRef}
        className="sticky top-0 z-10 -mx-sm bg-neutral-0/95 px-sm pt-xs pb-xs backdrop-blur dark:bg-secondary-900/95 sm:-mx-lg sm:px-lg"
      >
      {/* search + filters toggle + sort */}
      <div className="mb-sm flex gap-xs">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams…"
            // text-base (16px) keeps mobile Safari from auto-zooming on focus —
            // it zooms any input under 16px and never zooms back out on blur.
            // pr-lg leaves room for the clear button.
            className="w-full rounded-md border border-border bg-neutral-0 px-sm py-xxs pr-lg text-base text-content placeholder:text-content-subtle dark:bg-secondary-900"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute inset-y-0 right-0 flex items-center px-sm text-content-subtle hover:text-content"
            >
              ✕
            </button>
          )}
        </div>
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

      {/* saved-view chips — full-bleed horizontal scroller. The negative margins
          cancel the host page's px-sm/sm:px-lg gutters so the strip can scroll
          edge to edge; the matching px re-pads the inside so the first and last
          chips rest with a gutter rather than jammed against the screen edge. The
          scrollbar is hidden (it overlapped the chips on overflow). */}
      <div className="mb-xs -mx-sm flex gap-xs overflow-x-auto px-sm [scrollbar-width:none] sm:-mx-lg sm:px-lg [&::-webkit-scrollbar]:hidden">
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
      </div>

      {/* list */}
      <div ref={listRef} data-testid="games-list-region">
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
                  <MatchListCard key={g.id} game={g} now={now} onPick={onPick} onOpenDetail={openDetail} disabled={disabled} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      </div>

      {selectedGame && (
        <MatchDetailPanel
          game={selectedGame}
          detail={detail}
          loading={detailLoading}
          now={now}
          onPick={onPick}
          onClose={closeDetail}
          disabled={disabled}
        />
      )}
    </div>
  );
}
