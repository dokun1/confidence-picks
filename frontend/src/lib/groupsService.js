import AuthService from './authService.js';

function apiBase() {
  return `${AuthService.getApiBaseUrl()}/api/groups`;
}

async function authFetch(url, options = {}) {
  const token = AuthService.getToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });
  return res;
}

export async function getMyGroups() {
  const res = await authFetch(`${apiBase()}/my-groups`);
  if (!res.ok) throw new Error('Failed to load groups');
  const data = await res.json();
  // Map backend shape to UI expectations
  return data.map(g => ({
    id: g.id,
    name: g.name,
    identifier: g.identifier,
    description: g.description,
    memberCount: g.memberCount,
    isOwner: g.userRole === 'admin',
    userRole: g.userRole,
    createdAt: g.createdAt
  }));
}

export async function createGroup(payload) {
  const body = {
    name: payload.name,
    identifier: payload.identifier,
    description: payload.description,
    isPublic: true,
    maxMembers: 40
  };
  const res = await authFetch(`${apiBase()}`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  if (res.status === 409) throw new Error('Group identifier already exists');
  if (res.status === 400) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Invalid group data');
  }
  if (!res.ok) throw new Error('Failed to create group');
  return await res.json();
}

export async function getGroup(identifier) {
  const token = AuthService.getToken();
  const res = await fetch(`${apiBase()}/${identifier}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (res.status === 404) throw new Error('Group not found');
  if (res.status === 403) throw new Error('This group is private');
  if (!res.ok) throw new Error('Failed to load group');
  return await res.json();
}

export async function getMembers(identifier) {
  const res = await authFetch(`${apiBase()}/${identifier}/members`);
  if (!res.ok) throw new Error('Failed to load members');
  const data = await res.json();
  return data.map(m => ({
    id: m.id,
    name: m.name,
    email: m.email,
    isOwner: m.role === 'admin',
    joinedAt: m.joined_at,
    pictureUrl: m.picture_url
  }));
}

export async function getMessages(identifier, { limit = 50, offset = 0 } = {}) {
  const res = await authFetch(`${apiBase()}/${identifier}/messages?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error('Failed to load messages');
  const data = await res.json();
  return data.map(msg => ({
    id: msg.id,
    authorId: msg.user_id,
    authorName: msg.user_name,
    content: msg.message,
    createdAt: msg.created_at
  }));
}

export async function postMessage(identifier, message) {
  const res = await authFetch(`${apiBase()}/${identifier}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message })
  });
  if (!res.ok) throw new Error('Failed to post message');
  const data = await res.json();
  return {
    id: data.id,
    authorId: data.user_id,
    authorName: 'You', // Will be replaced if we have user info
    content: data.message,
    createdAt: data.created_at
  };
}

export async function leaveGroup(identifier) {
  const res = await authFetch(`${apiBase()}/${identifier}/leave`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to leave group');
}

export async function joinGroup(identifier) {
  const res = await authFetch(`${apiBase()}/${identifier}/join`, { method: 'POST' });
  if (res.status === 400) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Already a member or cannot join');
  }
  if (res.status === 403) throw new Error('Group is private, full, or access denied');
  if (res.status === 404) throw new Error('Group not found');
  if (!res.ok) throw new Error('Failed to join group');
  return await res.json().catch(() => ({}));
}

export async function updateGroup(identifier, updates) {
  // Only allow editable fields client-side: name, description, visibility, maxMembers (if supported)
  const allowed = ['name', 'description', 'isPublic', 'maxMembers'];
  const body = Object.fromEntries(Object.entries(updates || {}).filter(([k]) => allowed.includes(k)));
  if (Object.keys(body).length === 0) {
    throw new Error('No changes to save');
  }
  const res = await authFetch(`${apiBase()}/${identifier}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
  if (res.status === 404) throw new Error('Group not found');
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Not authorized to edit this group');
  }
  if (res.status === 400) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Invalid group update');
  }
  if (!res.ok) throw new Error('Failed to update group');
  return await res.json();
}

export async function deleteGroup(identifier) {
  const res = await authFetch(`${apiBase()}/${identifier}`, { method: 'DELETE' });
  if (res.status === 404) throw new Error('Group not found');
  if (res.status === 403) throw new Error('Not authorized to delete this group');
  if (!res.ok && res.status !== 204) throw new Error('Failed to delete group');
  return true;
}
