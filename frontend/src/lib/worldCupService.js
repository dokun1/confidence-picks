import AuthService from './authService.js';

function apiBase() { return AuthService.getApiBaseUrl(); }

async function authFetch(url, options = {}, attempt = 0) {
  const token = AuthService.getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });
  if ((res.status === 401 || res.status === 403) && attempt === 0) {
    try {
      await AuthService.refreshToken();
      const newToken = AuthService.getToken();
      return authFetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers||{}), Authorization: `Bearer ${newToken}` } }, 1);
    } catch (e) { /* fall through */ }
  }
  return res;
}

export async function getStageMatches(stage) {
  const res = await authFetch(`${apiBase()}/api/games/world-cup-2026/stage/${stage}`);
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.error || 'Failed to load stage matches');
  }
  return res.json();
}

// Whole-tournament slate in ONE request. Replaces the client-side seven-stage
// fan-out (Promise.all over getStageMatches) so a cold Picks-tab load is a single
// round-trip. Returns the same { games, count, cached } shape as getStageMatches,
// with games already flattened across every stage in calendar order.
export async function getAllWorldCupStages() {
  const res = await authFetch(`${apiBase()}/api/games/world-cup-2026/stages`);
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.error || 'Failed to load matches');
  }
  return res.json();
}

export async function submitWorldCupPicks(groupId, picks) {
  const res = await authFetch(`${apiBase()}/api/picks/group/${groupId}/world-cup`, { method: 'POST', body: JSON.stringify({ picks }) });
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.error || 'Failed to submit World Cup picks');
  }
  return res.json();
}

/**
 * Read the authenticated user's own World Cup picks for a group.
 * Returns { picks: [{ gameId, pickedResult }] } — same shape as the POST
 * response. The picker page hydrates its draft state with this so a refresh
 * doesn't blank out previously-saved choices.
 */
export async function getMyWorldCupPicks(groupId) {
  const res = await authFetch(`${apiBase()}/api/picks/group/${groupId}/world-cup/me`);
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.error || 'Failed to load World Cup picks');
  }
  return res.json();
}

/**
 * Read ANOTHER member's World Cup picks for a group. Returns
 * `{ picks: [{ gameId, pickedResult }], canEdit }`. `canEdit` is true only when
 * the caller is an admin — the picker uses it to decide whether the loaded
 * member's picks render read-only or editable. Any member may read; only admins
 * may write (see submitUserWorldCupPicks).
 */
export async function getUserWorldCupPicks(groupId, userId) {
  const res = await authFetch(`${apiBase()}/api/picks/group/${groupId}/world-cup/user/${userId}`);
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.error || 'Failed to load member World Cup picks');
  }
  return res.json();
}

/**
 * Submit World Cup picks on behalf of another member. ADMIN ONLY — the backend
 * rejects non-admins with 403. Scoped to a single group (no fan-out): an admin
 * override edits one member in the one group they administer.
 */
export async function submitUserWorldCupPicks(groupId, userId, picks) {
  const res = await authFetch(`${apiBase()}/api/picks/group/${groupId}/world-cup/user/${userId}`, { method: 'POST', body: JSON.stringify({ picks }) });
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.error || 'Failed to submit member World Cup picks');
  }
  return res.json();
}

export async function getWorldCupLeaderboard(groupId) {
  const res = await authFetch(`${apiBase()}/api/picks/group/${groupId}/world-cup/leaderboard`);
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.error || 'Failed to load World Cup leaderboard');
  }
  return res.json();
}

// On-demand match detail (venue + curated stats + per-side lineups) for the
// detail panel. Keyed by the real ESPN event id; resilient on the backend, so
// the panel still renders the game-side info if this throws.
export async function getMatchDetail(espnId) {
  const res = await authFetch(`${apiBase()}/api/games/world-cup-2026/event/${espnId}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to load match detail');
  }
  return res.json();
}
