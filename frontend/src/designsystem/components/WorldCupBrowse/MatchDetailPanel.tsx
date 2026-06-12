import { useState } from 'react';
import type { BrowseGame, MatchResult } from '../../../lib/wcGamesView';
import { isLocked } from '../../../lib/wcGamesView';
import type { EventDetail, MatchStat, PlayerMark, TeamLineup } from '../../../lib/wcMatchDetail';
import MatchTimeline from '../MatchTimeline';
import ChoiceButton from './ChoiceButton';

export interface MatchDetailPanelProps {
  game: BrowseGame;
  /** /event payload; null while the fetch is in flight. */
  detail: EventDetail | null;
  loading: boolean;
  now: Date;
  onPick: (gameId: number, result: MatchResult) => void;
  onClose: () => void;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-t border-border px-md py-sm">
    <div className="mb-xs text-[0.7rem] font-bold uppercase tracking-wide text-content-subtle">{title}</div>
    {children}
  </div>
);

// Inline hexes: these W/D/L + marker bg utilities aren't in the compiled CSS, so
// classed backgrounds (bg-success-500 etc.) wouldn't paint. Keep the prototype's
// inline-style approach.
const FORM_BG: Record<string, string> = { W: '#14a88e', L: '#ef4444', D: '#9b99bf' };
const FormPills = ({ seq }: { seq: string }) => (
  <div className="flex gap-xxs">
    {seq.split('').map((r, i) => (
      <span key={i} style={{ backgroundColor: FORM_BG[r] ?? '#9b99bf' }}
        className="flex h-5 w-5 items-center justify-center rounded-sm text-[0.6rem] font-bold text-neutral-0">{r}</span>
    ))}
  </div>
);

function Marker({ m }: { m: PlayerMark }) {
  if (m.kind === 'goal' || m.kind === 'own-goal') {
    return <span className="inline-flex items-center gap-xxs text-content-muted">⚽<span className="tabular-nums">{m.min}</span></span>;
  }
  if (m.kind === 'yellow') return <span className="inline-flex items-center gap-xxs"><span className="inline-block h-3 w-[0.55rem] rounded-[1px]" style={{ background: '#f5c518' }} /><span className="tabular-nums text-content-muted">{m.min}</span></span>;
  if (m.kind === 'red') return <span className="inline-flex items-center gap-xxs"><span className="inline-block h-3 w-[0.55rem] rounded-[1px]" style={{ background: '#ef4444' }} /><span className="tabular-nums text-content-muted">{m.min}</span></span>;
  if (m.kind === 'off') return <span className="inline-flex items-center gap-xxs font-semibold" style={{ color: '#ef4444' }}>↓<span className="tabular-nums">{m.min}</span></span>;
  return <span className="inline-flex items-center gap-xxs font-semibold" style={{ color: '#0c8772' }}>↑<span className="tabular-nums">{m.min}</span></span>;
}

const PlayerRow = ({ p }: { p: { num: string; name: string; marks: PlayerMark[] } }) => (
  <div className="flex items-center gap-sm py-xs">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary-100 text-xs font-bold tabular-nums text-content-muted dark:bg-secondary-800">{p.num}</span>
    <span className="flex-1 truncate text-sm font-medium text-content">{p.name}</span>
    <span className="flex items-center gap-sm text-xs">{p.marks.map((m, i) => <Marker key={i} m={m} />)}</span>
  </div>
);

const LINES: { key: 'GK' | 'DEF' | 'MID' | 'FWD'; label: string }[] = [
  { key: 'GK', label: 'Goalkeeper' }, { key: 'DEF', label: 'Defenders' },
  { key: 'MID', label: 'Midfielders' }, { key: 'FWD', label: 'Forwards' },
];

function TeamLineupView({ lineup }: { lineup: TeamLineup }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[0.7rem] font-bold uppercase tracking-wide text-content-subtle">Starting XI</span>
        {lineup.formation && <span className="text-xs font-semibold text-content-muted">{lineup.formation}</span>}
      </div>
      {LINES.map((ln) => {
        const players = lineup.starters.filter((p) => p.line === ln.key);
        if (!players.length) return null;
        return (
          <div key={ln.key}>
            <div className="px-xxs pb-xxs pt-sm text-[0.65rem] font-bold uppercase tracking-wide text-content-subtle">{ln.label}</div>
            {players.map((p) => <PlayerRow key={p.num} p={p} />)}
          </div>
        );
      })}
      {lineup.subs.length > 0 && (
        <>
          <div className="px-xxs pb-xxs pt-md text-[0.7rem] font-bold uppercase tracking-wide text-content-subtle">Substitutes used</div>
          {lineup.subs.map((p) => <PlayerRow key={p.num} p={p} />)}
        </>
      )}
    </div>
  );
}

function Lineups({ game, detail, loading }: { game: BrowseGame; detail: EventDetail | null; loading: boolean }) {
  const [side, setSide] = useState<'home' | 'away'>('home');
  if (loading || !detail) return <p className="text-sm text-content-subtle">Loading lineups…</p>;
  if (!detail.lineups) return <p className="text-sm text-content-subtle">Lineups not available.</p>;
  const lineup = side === 'home' ? detail.lineups.home : detail.lineups.away;
  return (
    <div>
      <div className="mb-sm flex gap-xs">
        {(['home', 'away'] as const).map((s) => {
          const t = s === 'home' ? game.home : game.away;
          return (
            <button key={s} type="button" onClick={() => setSide(s)}
              className={`flex flex-1 items-center justify-center gap-xs rounded-md py-xxs text-sm font-semibold ${side === s ? 'bg-accent text-accent-fg' : 'border border-border text-content-muted'}`}>
              <img src={t.logo} alt="" className="h-icon-sm w-icon-sm object-contain" /> {t.name}
            </button>
          );
        })}
      </div>
      <TeamLineupView lineup={lineup} />
    </div>
  );
}

/** Parse a stat's display value to a number for bar proportioning ("60.5%" → 60.5). */
function statValue(v: string): number | null {
  const n = parseFloat(String(v).replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function MatchStats({ game, detail }: { game: BrowseGame; detail: EventDetail }) {
  if (!detail.stats.length) return null;
  return (
    <div className="space-y-sm">
      {detail.stats.map((st: MatchStat) => {
        const h = statValue(st.home);
        const a = statValue(st.away);
        const total = h != null && a != null ? h + a : null;
        const homePct = total && total > 0 ? (h! / total) * 100 : null;
        return (
          <div key={st.label}>
            <div className="flex justify-between text-xs">
              <span className="font-bold tabular-nums text-content">{st.home}</span>
              <span className="text-content-subtle">{st.label}</span>
              <span className="font-bold tabular-nums text-content">{st.away}</span>
            </div>
            {homePct != null && (
              <div className="mt-xxs flex h-1.5 overflow-hidden rounded-pill bg-secondary-200 dark:bg-secondary-700">
                <div className="bg-accent" style={{ width: `${homePct}%` }} />
              </div>
            )}
          </div>
        );
      })}
      <p className="text-[0.65rem] text-content-subtle">{game.home.abbr} (left) · {game.away.abbr} (right)</p>
    </div>
  );
}

export default function MatchDetailPanel({ game, detail, loading, now, onPick, onClose }: MatchDetailPanelProps) {
  const locked = isLocked(game, now);
  const live = game.status === 'IN_PROGRESS';
  const kickoff = new Date(game.kickoff);
  const dateLabel = kickoff.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeLabel = kickoff.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const venue = detail?.venue ?? null;
  const meta = venue ? `${dateLabel} · ${timeLabel} · ${venue}` : `${dateLabel} · ${timeLabel}`;
  const events = game.events ?? [];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 flex h-full w-full max-w-[460px] flex-col overflow-y-auto bg-surface shadow-2xl">
        {/* header */}
        <div className="px-md pb-sm pt-md">
          <button type="button" onClick={onClose} className="mb-md text-sm font-semibold text-content-muted">‹ Back</button>
          <div className="flex items-center justify-between">
            <div className="w-28 text-center">
              <img src={game.home.logo} alt="" className="mx-auto h-12 w-12 object-contain" />
              <div className="mt-xs font-bold text-content">{game.home.name}</div>
            </div>
            <div className="text-center">
              {locked ? (
                <>
                  <div className="text-2xl font-extrabold tabular-nums text-content">{game.homeScore} – {game.awayScore}</div>
                  <div className={`text-xs font-bold ${live ? 'text-error-500' : 'text-content-subtle'}`}>{live ? 'LIVE' : 'FULL TIME'}</div>
                </>
              ) : (
                <div className="text-xs font-bold uppercase tracking-wide text-content-subtle">Kickoff</div>
              )}
              <div className="mt-xxs text-xs text-content-subtle">{game.stageLabel}</div>
            </div>
            <div className="w-28 text-center">
              <img src={game.away.logo} alt="" className="mx-auto h-12 w-12 object-contain" />
              <div className="mt-xs font-bold text-content">{game.away.name}</div>
            </div>
          </div>
          {/* date + time, plus venue from the /event fetch when present */}
          <div className="mt-sm text-center text-xs text-content-subtle">{meta}</div>
        </div>

        {/* pick controls (only when not locked) */}
        {!locked && (
          <Section title="Your pick">
            <div className="flex gap-xs">
              <ChoiceButton team={game.home} odds={game.home.moneyline} record={game.home.record} selected={game.picked === 'home'} onClick={() => onPick(game.id, 'home')} />
              <ChoiceButton odds={game.drawOdds} selected={game.picked === 'draw'} onClick={() => onPick(game.id, 'draw')} />
              <ChoiceButton team={game.away} odds={game.away.moneyline} record={game.away.record} selected={game.picked === 'away'} onClick={() => onPick(game.id, 'away')} />
            </div>
            {game.overUnder && <p className="mt-xs text-center text-xs text-content-subtle">DraftKings · O/U {game.overUnder}</p>}
          </Section>
        )}

        {/* locked: timeline + stats; scheduled: form */}
        {locked ? (
          <>
            {events.length > 0 && <Section title="Timeline"><MatchTimeline events={events} /></Section>}
            {detail && detail.stats.length > 0 && <Section title="Match stats"><MatchStats game={game} detail={detail} /></Section>}
          </>
        ) : (
          (game.home.form || game.away.form) && (
            <Section title="Form · last 5">
              <div className="space-y-xs">
                {game.home.form && (
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold text-content">{game.home.name}</span><FormPills seq={game.home.form} /></div>
                )}
                {game.away.form && (
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold text-content">{game.away.name}</span><FormPills seq={game.away.form} /></div>
                )}
              </div>
            </Section>
          )
        )}

        <Section title="Lineups"><Lineups game={game} detail={detail} loading={loading} /></Section>
        <div className="h-lg" />
      </div>
    </div>
  );
}
