export interface User {
  id: string;
  email: string;
  name: string;
  pictureUrl: string;
  provider: string;
}

export interface Group {
  id: string;
  name: string;
  identifier: string;
  description?: string;
  memberCount: number;
  isOwner: boolean;
  userRole?: string;
  createdAt: string;
  createdByName?: string | null;
  createdByPictureUrl?: string | null;
}

export interface GroupMember {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
  joinedAt: string;
  pictureUrl: string;
}

export interface GroupMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorPictureUrl: string;
  content: string;
  createdAt: string;
}

export interface TeamData {
  id: string;
  name: string;
  abbreviation: string;
  logo: string;
  color?: string;
  altColor?: string;
}

export interface GameData {
  id: number;
  espnId: string;
  homeTeam: TeamData;
  awayTeam: TeamData;
  homeScore: number;
  awayScore: number;
  status: string;
  statusDetail?: string;
  gameDate: string;
  week: number;
  season: number;
  seasonType: number;
  period?: number;
  displayClock?: string;
}

export interface PickData {
  gameId: number;
  pickedTeamId: string | null;
  confidence: number | null;
  won: boolean | null;
  points: number | null;
}

export interface InviteGroup {
  identifier: string;
  name: string;
  description: string;
  memberCount: number;
  maxMembers: number;
  ownerName: string;
  ownerPictureUrl: string;
}

export interface InviteDetails {
  valid: boolean;
  reason?: string;
  alreadyMember: boolean;
  group: InviteGroup;
  invite: {
    token: string;
    expiresAt: string;
    maxUses: number | null;
    uses: number;
    remainingUses: number | null;
  };
}
