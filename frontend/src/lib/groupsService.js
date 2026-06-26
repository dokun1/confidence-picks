import AuthService from './authService.js';

function apiBase() {
  return `${AuthService.getApiBaseUrl()}/api/groups`;
}

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
  // If unauthorized/forbidden, attempt silent refresh once
  if ((res.status === 401 || res.status === 403) && attempt === 0) {
    try {
      await AuthService.refreshToken();
      const newToken = AuthService.getToken();
      return authFetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
          Authorization: `Bearer ${newToken}`
        }
      }, 1);
    } catch (e) {
      // fall through; caller will handle error
    }
  }
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
  createdAt: g.createdAt,
  createdByName: g.createdByName || null,
  createdByPictureUrl: g.createdByPictureUrl || null,
  // Forwarded so the picks pages can fan a single submit out to every group
  // of the same poolType ('save to all my World Cup groups' / NFL groups).
  poolType: g.poolType || null,
  // World Cup knockout-only sub-setting; lets the picks tab hide group-stage
  // games even on the standalone /world-cup surface (no group object loaded).
  knockoutOnly: Boolean(g.knockoutOnly)
  }));
}

export async function createGroup(payload) {
  const body = {
    name: payload.name,
    identifier: payload.identifier,
    description: payload.description,
    isPublic: true,
    maxMembers: payload.maxMembers ?? 50
  };
  // Only forward poolType when provided so existing NFL group creation is unchanged.
  if (payload.poolType) body.poolType = payload.poolType;
  // knockoutOnly is a World Cup sub-setting; only forward it when truthy so NFL
  // group creation is byte-for-byte unchanged (the server rejects it for NFL).
  if (payload.knockoutOnly) body.knockoutOnly = true;
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
  const data = await res.json();
  // Map the backend snake_case pool_type onto a camelCase poolType property.
  // The Group model serializes camelCase (poolType/knockoutOnly), but tolerate a
  // raw snake_case row too (some callers/tests stub the bare DB shape).
  return {
    ...data,
    ...(data.pool_type != null ? { poolType: data.pool_type } : {}),
    ...(data.knockout_only != null ? { knockoutOnly: data.knockout_only } : {}),
  };
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
    authorId: msg.authorId,
    authorName: msg.authorName,
    authorPictureUrl: msg.authorPictureUrl,
    content: msg.content,
    createdAt: msg.createdAt
  }));
}

export async function getUnreadStatus(identifier) {
  const res = await authFetch(`${apiBase()}/${identifier}/messages/unread`);
  if (!res.ok) throw new Error('Failed to load unread status');
  const data = await res.json();
  return Boolean(data.hasUnread);
}

export async function markMessagesRead(identifier) {
  const res = await authFetch(`${apiBase()}/${identifier}/messages/read`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to mark messages read');
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
  authorId: data.authorId,
  authorName: data.authorName,
  authorPictureUrl: data.authorPictureUrl,
  content: data.content,
  createdAt: data.createdAt
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
  // 409: the new member limit is below the current member count. Surface the
  // server's message verbatim so the admin sees that members must leave first.
  if (res.status === 409) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Member limit is below the current member count; members must leave first');
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
