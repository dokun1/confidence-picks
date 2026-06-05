// Type declarations for the untyped JS groups service (groupsService.js).
// tsconfig has strict (noImplicitAny) but not allowJs, so every .ts/.tsx import
// of this module would otherwise resolve to `any` and fail. This .d.ts provides
// real types for the public API actually consumed by the app, mirroring the
// authService.d.ts pattern. getMyGroups already returns objects shaped like
// GroupCard's GroupData, so it is typed as such.

import type { GroupData } from '../designsystem/components/GroupCard/GroupCard';

export interface GroupDetail {
  id: string;
  name: string;
  identifier: string;
  description?: string;
  isPublic?: boolean;
  maxMembers?: number;
  memberCount?: number;
  userRole?: string;
  createdAt?: string;
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
export function createGroup(payload: {
  name: string;
  identifier: string;
  description?: string;
}): Promise<GroupDetail>;
export function getGroup(identifier: string): Promise<GroupDetail>;
export function getMembers(identifier: string): Promise<GroupMember[]>;
export function getMessages(
  identifier: string,
  opts?: { limit?: number; offset?: number },
): Promise<GroupMessage[]>;
export function postMessage(identifier: string, message: string): Promise<GroupMessage>;
export function leaveGroup(identifier: string): Promise<void>;
export function joinGroup(identifier: string): Promise<GroupDetail>;
export function updateGroup(
  identifier: string,
  updates: Partial<Pick<GroupDetail, 'name' | 'description' | 'isPublic' | 'maxMembers'>>,
): Promise<GroupDetail>;
export function deleteGroup(identifier: string): Promise<boolean>;
