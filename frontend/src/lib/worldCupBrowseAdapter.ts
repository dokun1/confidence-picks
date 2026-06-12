import type { BrowseGame, GameStatus, MatchResult } from './wcGamesView';
import type { WorldCupMatch, WorldCupStage } from './types';

type DraftMap = Record<number, MatchResult>;

const STAGE_LABEL: Record<WorldCupStage, string> = {
  group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarterfinals', sf: 'Semifinals', third: 'Third Place', final: 'Final',
};

const NORMALIZED: Record<string, GameStatus> = {
  SCHEDULED: 'SCHEDULED', IN_PROGRESS: 'IN_PROGRESS', FINAL: 'FINAL',
};

export function toBrowseGames(matches: WorldCupMatch[], draft: DraftMap): BrowseGame[] {
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
    },
    away: {
      abbr: m.awayTeam.abbreviation,
      name: m.awayTeam.name,
      logo: m.awayTeam.logo,
      record: m.awayTeam.record || undefined,
      moneyline: m.odds?.threeWay?.away || undefined,
      form: m.awayTeam.form || undefined,
    },
    // `|| undefined` (not `??`) so an empty-string odds/record from ESPN also
    // collapses to absent — the card renders nothing rather than an empty line.
    drawOdds: m.odds?.threeWay?.draw || undefined,
    overUnder: m.odds?.overUnder != null ? String(m.odds.overUnder) : undefined,
    status: NORMALIZED[m.status] ?? 'SCHEDULED',
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    picked: draft[m.id],
    // Derive from the stage rather than trusting m.isKnockout: the stage route
    // doesn't actually emit that flag, so it arrives undefined and left the Draw
    // pick enabled on knockout matches. Every non-group stage is single-elimination
    // (PKs decide), so Draw must be disabled — see MatchListCard.
    isKnockout: m.stage !== 'group',
    events: m.events,
  }));
}
