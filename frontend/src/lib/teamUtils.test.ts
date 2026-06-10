import { describe, it, expect } from 'vitest';
import { isTeamAssigned, hasBothTeamsAssigned } from './teamUtils';
import type { TeamData } from './types';

const mexico: TeamData = { id: '203', name: 'Mexico', abbreviation: 'MEX', logo: '' };
const canada: TeamData = { id: '204', name: 'Canada', abbreviation: 'CAN', logo: '' };

function tbdTeam(overrides: Partial<TeamData> = {}): TeamData {
  return { id: 'tbd-1', name: 'TBD', abbreviation: 'TBD', logo: '', ...overrides };
}

describe('isTeamAssigned', () => {
  it('accepts a real team', () => {
    expect(isTeamAssigned(mexico)).toBe(true);
  });

  it('rejects a missing team slot', () => {
    expect(isTeamAssigned(null)).toBe(false);
    expect(isTeamAssigned(undefined)).toBe(false);
  });

  it('rejects a team without an id', () => {
    expect(isTeamAssigned({ ...mexico, id: '' })).toBe(false);
  });

  it('rejects ESPN TBD placeholders regardless of case or padding', () => {
    expect(isTeamAssigned(tbdTeam())).toBe(false);
    expect(isTeamAssigned(tbdTeam({ name: 'tbd', abbreviation: ' TBD ' }))).toBe(false);
    expect(isTeamAssigned(tbdTeam({ name: 'To Be Determined', abbreviation: '' }))).toBe(false);
    expect(isTeamAssigned(tbdTeam({ name: 'To Be Announced', abbreviation: 'TBA' }))).toBe(false);
  });

  it('rejects a team with no name and no abbreviation', () => {
    expect(isTeamAssigned(tbdTeam({ name: '', abbreviation: '' }))).toBe(false);
  });

  it('accepts a team when either label is real', () => {
    // A real name with a placeholder/missing abbreviation is still a real team.
    expect(isTeamAssigned(tbdTeam({ name: 'Mexico', abbreviation: '' }))).toBe(true);
    expect(isTeamAssigned(tbdTeam({ name: '', abbreviation: 'MEX' }))).toBe(true);
  });
});

describe('hasBothTeamsAssigned', () => {
  it('is true when both slots hold real teams', () => {
    expect(hasBothTeamsAssigned({ homeTeam: mexico, awayTeam: canada })).toBe(true);
  });

  it('is false when either slot is a TBD placeholder', () => {
    expect(hasBothTeamsAssigned({ homeTeam: mexico, awayTeam: tbdTeam() })).toBe(false);
    expect(hasBothTeamsAssigned({ homeTeam: tbdTeam(), awayTeam: canada })).toBe(false);
    expect(hasBothTeamsAssigned({ homeTeam: tbdTeam(), awayTeam: tbdTeam() })).toBe(false);
  });
});
