// Type declarations for the untyped JS invites service (invitesService.js).
// tsconfig has strict (noImplicitAny) but not allowJs, so every .ts/.tsx import
// of this module would otherwise resolve to `any` and fail. This .d.ts provides
// real types for the public API actually consumed by the app, mirroring the
// groupsService.d.ts / authService.d.ts pattern.

import type { InviteDetails } from './types';

export interface LinkInvite {
  // The shareable join URL — the only field consumed by callers (SettingsTab
  // stores it and copies it to the clipboard).
  joinUrl: string;
}

export interface CreateLinkInviteOptions {
  expiresInDays?: number;
  maxUses?: number | null;
}

// Result of accepting an invite (POST /invites/:token/accept). `groupIdentifier`
// is what InvitePage navigates to after a successful join.
export interface AcceptInviteResult {
  joined: boolean;
  alreadyMember: boolean;
  groupIdentifier: string;
}

export function createLinkInvite(
  groupIdentifier: string,
  options?: CreateLinkInviteOptions,
): Promise<LinkInvite>;
export function getInvite(token: string): Promise<InviteDetails>;
export function acceptInvite(token: string): Promise<AcceptInviteResult>;
