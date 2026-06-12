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
    espnId: String(m.id), // TODO: use the real ESPN id once the stage API exposes it (P3 detail keys off it)
    stage: m.stage,
    stageLabel: STAGE_LABEL[m.stage] ?? m.stage,
    kickoff: m.gameDate ?? '',
    home: { abbr: m.homeTeam.abbreviation, name: m.homeTeam.name, logo: m.homeTeam.logo },
    away: { abbr: m.awayTeam.abbreviation, name: m.awayTeam.name, logo: m.awayTeam.logo },
    status: NORMALIZED[m.status] ?? 'SCHEDULED',
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    picked: draft[m.id],
    // Derive from the stage rather than trusting m.isKnockout: the stage route
    // doesn't actually emit that flag, so it arrives undefined and left the Draw
    // pick enabled on knockout matches. Every non-group stage is single-elimination
    // (PKs decide), so Draw must be disabled — see MatchListCard.
    isKnockout: m.stage !== 'group',
  }));
}
