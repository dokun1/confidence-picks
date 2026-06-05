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

export async function submitWorldCupPicks(groupId, picks) {
  const res = await authFetch(`${apiBase()}/api/picks/group/${groupId}/world-cup`, { method: 'POST', body: JSON.stringify({ picks }) });
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.error || 'Failed to submit World Cup picks');
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
