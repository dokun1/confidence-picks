import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MatchDetailPanel from './MatchDetailPanel';
import type { BrowseGame } from '../../../lib/wcGamesView';
import type { EventDetail } from '../../../lib/wcMatchDetail';

const baseGame = (over: Partial<BrowseGame> = {}): BrowseGame => ({
  id: 1,
  espnId: 'espn-1',
  stage: 'group',
  stageLabel: 'Group Stage',
  kickoff: '2026-06-12T17:00:00Z',
  home: { abbr: 'MEX', name: 'Mexico', logo: 'mex.png' },
  away: { abbr: 'RSA', name: 'South Africa', logo: 'rsa.png' },
  status: 'SCHEDULED',
  isKnockout: false,
  ...over,
});

const now = new Date('2026-06-11T00:00:00Z'); // before kickoff → scheduled

describe('MatchDetailPanel', () => {
  it('shows the matchup and a lineups-loading note for a scheduled game with no detail yet', () => {
    render(
      <MatchDetailPanel
        game={baseGame()}
        detail={null}
        loading={true}
        now={now}
        onPick={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Mexico')).toBeInTheDocument();
    expect(screen.getByText('South Africa')).toBeInTheDocument();
    expect(screen.getByText('Loading lineups…')).toBeInTheDocument();
  });

  it('renders venue, a match stat, and a starter name for a final game with detail', () => {
    const game = baseGame({
      status: 'FINAL',
      kickoff: '2026-06-01T17:00:00Z', // in the past → locked
      homeScore: 2,
      awayScore: 0,
    });
    const detail: EventDetail = {
      venue: 'Estadio Banorte · Mexico City',
      stats: [{ label: 'Possession', home: '60.5%', away: '39.5%' }],
      lineups: {
        home: {
          abbr: 'MEX',
          name: 'Mexico',
          formation: '4-1-4-1',
          starters: [{ num: '9', name: 'Raúl Jiménez', line: 'FWD', marks: [] }],
          subs: [],
        },
        away: { abbr: 'RSA', name: 'South Africa', formation: '4-4-2', starters: [], subs: [] },
      },
    };
    render(
      <MatchDetailPanel
        game={game}
        detail={detail}
        loading={false}
        now={new Date('2026-06-11T00:00:00Z')}
        onPick={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Estadio Banorte/)).toBeInTheDocument();
    expect(screen.getByText('Possession')).toBeInTheDocument();
    expect(screen.getByText('Raúl Jiménez')).toBeInTheDocument();
  });
});
