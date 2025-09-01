// Mock data for game picks testing
export const mockGames = [
  {
    id: '1',
    awayTeam: {
      id: '1',
      name: 'Buffalo Bills',
      abbreviation: 'BUF',
      color: '00338D'
    },
    homeTeam: {
      id: '2', 
      name: 'Miami Dolphins',
      abbreviation: 'MIA',
      color: '008E97'
    },
    date: '2025-09-07T17:00:00Z',
    status: 'SCHEDULED',
    awayScore: 0,
    homeScore: 0,
    meta: {
      final: false
    }
  },
  {
    id: '2',
    awayTeam: {
      id: '3',
      name: 'New England Patriots', 
      abbreviation: 'NE',
      color: '002244'
    },
    homeTeam: {
      id: '4',
      name: 'New York Jets',
      abbreviation: 'NYJ', 
      color: '125740'
    },
    date: '2025-09-07T20:00:00Z',
    status: 'SCHEDULED',
    awayScore: 0,
    homeScore: 0,
    meta: {
      final: false
    }
  },
  {
    id: '3',
    awayTeam: {
      id: '5',
      name: 'Pittsburgh Steelers',
      abbreviation: 'PIT',
      color: 'FFB612'
    },
    homeTeam: {
      id: '6',
      name: 'Baltimore Ravens',
      abbreviation: 'BAL',
      color: '241773'
    },
    date: '2025-09-08T13:00:00Z',
    status: 'SCHEDULED', 
    awayScore: 0,
    homeScore: 0,
    meta: {
      final: false
    }
  }
];

export const mockUserPicks = {
  '1': {
    groupId: 'test-group',
    userId: 'test-user',
    picks: []
  }
};

export const mockGroupData = {
  id: 'test-group',
  name: 'Test Group',
  members: [
    {
      id: 'test-user',
      name: 'Test User',
      email: 'test@example.com'
    }
  ]
};

// Helper function to create a mock pick response
export function createMockPicksResponse(groupId, season = 2025, seasonType = 2, week = 1) {
  return {
    games: mockGames,
    picks: mockUserPicks[groupId]?.picks || [],
    season,
    seasonType, 
    week,
    meta: {
      canMakePicks: true,
      weekStarted: false
    }
  };
}

// Helper function to simulate saving picks
export function createMockSavePicksResponse(picks) {
  return {
    success: true,
    picks: picks.map(pick => ({
      ...pick,
      saved: true,
      timestamp: new Date().toISOString()
    }))
  };
}
