import type { BrowseGame, GameStatus, MatchResult } from './wcGamesView';
import type { WorldCupMatch, WorldCupStage } from './types';
import { teamGroup } from './wcGroups';

type DraftMap = Record<number, MatchResult>;
type ScoreDraftMap = Record<number, { home?: number | null; away?: number | null }>;

const STAGE_LABEL: Record<WorldCupStage, string> = {
  group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarterfinals', sf: 'Semifinals', third: 'Third Place', final: 'Final',
};

const NORMALIZED: Record<string, GameStatus> = {
  SCHEDULED: 'SCHEDULED', IN_PROGRESS: 'IN_PROGRESS', FINAL: 'FINAL',
};

export function toBrowseGames(matches: WorldCupMatch[], draft: DraftMap, scoreDraft?: ScoreDraftMap): BrowseGame[] {
  return matches.map((m) => ({
    id: m.id,
    espnId: m.espnId ?? String(m.id),
    stage: m.stage,
    stageLabel: STAGE_LABEL[m.stage] ?? m.stage,
    kickoff: m.gameDate ?? '',
    home: {
      abbr: m.homeTeam.abbreviation,
      name: m.homeTeam.name,
      logo: m.homeTeam.logo,
      record: m.homeTeam.record || undefined,
      moneyline: m.odds?.threeWay?.home || undefined,
      form: m.homeTeam.form || undefined,
      isActive: m.homeTeam.isActive,
    },
    away: {
      abbr: m.awayTeam.abbreviation,
      name: m.awayTeam.name,
      logo: m.awayTeam.logo,
      record: m.awayTeam.record || undefined,
      moneyline: m.odds?.threeWay?.away || undefined,
      form: m.awayTeam.form || undefined,
      isActive: m.awayTeam.isActive,
    },
    // `|| undefined` (not `??`) so an empty-string odds/record from ESPN also
    // collapses to absent — the card renders nothing rather than an empty line.
    drawOdds: m.odds?.threeWay?.draw || undefined,
    overUnder: m.odds?.overUnder != null ? String(m.odds.overUnder) : undefined,
    status: NORMALIZED[m.status] ?? 'SCHEDULED',
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    // Live progress (minute mark / half / descriptive state). `|| undefined` so
    // an empty-string clock from a cached pre-kickoff row collapses to absent
    // and liveClockLabel reads it as "no minute yet".
    displayClock: m.displayClock || undefined,
    statusDetail: m.statusDetail || undefined,
    period: m.period,
    picked: draft[m.id],
    // Derive from the stage rather than trusting m.isKnockout: the stage route
    // doesn't actually emit that flag, so it arrives undefined and left the Draw
    // pick enabled on knockout matches. Every non-group stage is single-elimination
    // (PKs decide), so Draw must be disabled — see MatchListCard.
    isKnockout: m.stage !== 'group',
    events: m.events,
    // Group-stage games carry a FIFA group letter (A–L) derived from the team
    // abbreviation. Knockout teams may share abbreviations with group-stage
    // placeholders, so we only populate this on group-stage matches.
    wcGroup: m.stage === 'group'
      ? (teamGroup(m.homeTeam.abbreviation) ?? teamGroup(m.awayTeam.abbreviation))
      : undefined,
    // Score predictions — knockout matches only; sourced from the parallel
    // scoreDraft in WorldCupPicksTab. Group-stage matches leave these absent.
    predictedHomeScore: scoreDraft?.[m.id]?.home,
    predictedAwayScore: scoreDraft?.[m.id]?.away,
  }));
}
