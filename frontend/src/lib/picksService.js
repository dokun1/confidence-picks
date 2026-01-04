import AuthService from './authService.js';

function apiBase() { return `${AuthService.getApiBaseUrl()}/api/groups`; }

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

export async function getClosestWeek(groupIdentifier, season, seasonType) {
  const params = new URLSearchParams({ season, seasonType });
  const res = await authFetch(`${apiBase()}/${groupIdentifier}/picks/closest?${params}`);
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.error || 'Failed to load closest week');
  }
  return res.json();
}

export async function getPicks(groupIdentifier, { season, seasonType, week }) {
  const params = new URLSearchParams({ season, seasonType, week });
  const res = await authFetch(`${apiBase()}/${groupIdentifier}/picks?${params}`);
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.error || 'Failed to load picks');
  }
  return res.json();
}

export async function savePicks(groupIdentifier, body) {
  const res = await authFetch(`${apiBase()}/${groupIdentifier}/picks`, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err.error || 'Failed to save picks');
  }
  return res.json();
}

export async function clearPicks(groupIdentifier, body) {
  const res = await authFetch(`${apiBase()}/${groupIdentifier}/picks/clear`, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.error || 'Failed to clear picks');
  }
  return res.json();
}

export async function getScoreboard(groupIdentifier, { season, seasonType }) {
  const params = new URLSearchParams({ season, seasonType });
  const res = await authFetch(`${apiBase()}/${groupIdentifier}/scoreboard?${params}`);
  if (!res.ok) { const data = await res.json().catch(()=>({})); throw new Error(data.error || 'Failed to load scoreboard'); }
  return res.json();
}

export async function getUserPicks(groupIdentifier, userId, { season, seasonType, week }) {
  const params = new URLSearchParams({ season, seasonType, week });
  const res = await authFetch(`${apiBase()}/${groupIdentifier}/picks/user/${userId}?${params}`);
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.error || 'Failed to load user picks');
  }
  return res.json();
}

export async function saveUserPicks(groupIdentifier, userId, body) {
  const res = await authFetch(`${apiBase()}/${groupIdentifier}/picks/user/${userId}`, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(()=>({}));
    throw new Error(err.error || 'Failed to save user picks');
  }
  return res.json();
}
