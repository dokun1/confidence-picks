// Type declarations for the untyped JS groups service (groupsService.js).
// tsconfig has strict (noImplicitAny) but not allowJs, so every .ts/.tsx import
// of this module would otherwise resolve to `any` and fail. This .d.ts provides
// real types for the public API actually consumed by the app, mirroring the
// authService.d.ts pattern. getMyGroups already returns objects shaped like
// GroupCard's GroupData, so it is typed as such.

import type { GroupData } from '../designsystem/components/GroupCard/GroupCard';
import type { PoolType } from './types';

export interface GroupDetail {
  // Optional: the backend returns id, but no consumer reads it off getGroup, and
  // joinGroup's runtime fallback (`res.json().catch(() => ({}))`) can resolve to
  // an id-less object. Typing it required would overstate the contract.
  id?: string;
  name: string;
  identifier: string;
  description?: string;
  isPublic?: boolean;
  maxMembers?: number;
  memberCount?: number;
  userRole?: string;
  createdAt?: string;
  poolType?: PoolType;
  // World Cup 2026 sub-setting: group allows only knockout-stage picks.
  knockoutOnly?: boolean;
}

export interface GroupMember {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
  joinedAt: string;
  pictureUrl: string | null;
}

export interface GroupMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorPictureUrl: string | null;
  content: string;
  createdAt: string;
}

export function getMyGroups(): Promise<GroupData[]>;
// createGroup/updateGroup/joinGroup resolve to a parsed JSON body at runtime, but
// every page consumes them as fire-and-forget (await, then navigate) and never
// reads the resolved value. Typed as void to match actual consumption.
export function createGroup(payload: {
  name: string;
  identifier: string;
  description?: string;
  poolType?: PoolType;
  knockoutOnly?: boolean;
}): Promise<void>;
export function getGroup(identifier: string): Promise<GroupDetail>;
export function getMembers(identifier: string): Promise<GroupMember[]>;
export function getMessages(
  identifier: string,
  opts?: { limit?: number; offset?: number },
): Promise<GroupMessage[]>;
export function postMessage(identifier: string, message: string): Promise<GroupMessage>;
// Whether the caller has unread chat messages in the group (drives the Chat tab's
// red dot). markMessagesRead clears that state server-side when the chat is opened.
export function getUnreadStatus(identifier: string): Promise<boolean>;
export function markMessagesRead(identifier: string): Promise<void>;
export function leaveGroup(identifier: string): Promise<void>;
export function joinGroup(identifier: string): Promise<void>;
export function updateGroup(
  identifier: string,
  updates: Partial<Pick<GroupDetail, 'name' | 'description' | 'isPublic' | 'maxMembers'>>,
): Promise<void>;
export function deleteGroup(identifier: string): Promise<boolean>;
