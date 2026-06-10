import type { TeamData, WorldCupMatch } from './types';

// Knockout fixtures exist in the schedule before their participants are known
// (e.g. a Round of 32 slot waiting on group-stage results). ESPN fills those
// slots with placeholder "team" entries — typically named/abbreviated "TBD" —
// rather than omitting them, so a fixture being present does NOT mean both
// teams are assigned. Picks must be gated on real assignments: a pick against
// a placeholder can never be scored.

/** Placeholder names ESPN uses for an unassigned knockout slot. */
const PLACEHOLDER_NAMES = new Set(['tbd', 'to be determined', 'to be announced', 'tba']);

function isPlaceholderLabel(label: string | null | undefined): boolean {
  return !label || PLACEHOLDER_NAMES.has(label.trim().toLowerCase());
}

/**
 * Whether a team slot holds a real, scheduled team — present, identified, and
 * not an ESPN "TBD"-style placeholder.
 */
export function isTeamAssigned(team: TeamData | null | undefined): boolean {
  if (!team || !team.id) return false;
  return !(isPlaceholderLabel(team.name) && isPlaceholderLabel(team.abbreviation));
}

/**
 * Whether both of a match's team slots are filled with real teams. Matches
 * failing this are not pickable: there is nothing concrete to pick yet.
 */
export function hasBothTeamsAssigned(
  match: Pick<WorldCupMatch, 'homeTeam' | 'awayTeam'>,
): boolean {
  return isTeamAssigned(match.homeTeam) && isTeamAssigned(match.awayTeam);
}
