import AuthService from './authService.js';

const API_BASE = () => `${AuthService.getApiBaseUrl()}/api`;

async function authFetch(url, options = {}, attempt = 0) {
  const token = AuthService.getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  if ((res.status === 401 || res.status === 403) && attempt === 0 && token) {
    try {
      await AuthService.refreshToken();
      const newToken = AuthService.getToken();
      return authFetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers||{}), Authorization: `Bearer ${newToken}` } }, 1);
    } catch (_) {}
  }
  return res;
}

export async function createLinkInvite(groupIdentifier, { expiresInDays = 14, maxUses = null } = {}) {
  const res = await authFetch(`${API_BASE()}/groups/${groupIdentifier}/invites`, { method: 'POST', body: JSON.stringify({ expiresInDays, maxUses }) });
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.error || 'Failed to create invite');
  }
  return res.json();
}

export async function getInvite(token) {
  const res = await authFetch(`${API_BASE()}/invites/${token}`);
  if (res.status === 404) throw new Error('Invitation not found');
  if (!res.ok) throw new Error('Failed to load invitation');
  return res.json();
}

export async function acceptInvite(token) {
  const res = await authFetch(`${API_BASE()}/invites/${token}/accept`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.error || 'Failed to accept invite');
  }
  return res.json();
}
