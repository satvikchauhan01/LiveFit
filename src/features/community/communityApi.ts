import type {
  ApiUser,
  ChallengeKind,
  ChallengeSummary,
  ClubMember,
  ClubSummary,
  FeedResponse,
  InboxItem,
  LeaderboardRow,
  PrivacyZone,
  PublicProfile,
  PublicUser,
  ReportReason,
  ReportTarget,
  SharedWorkout,
  SocialSettingsDoc,
  WorkoutComment,
} from '@shared/api';

import { api } from '@/features/account/apiClient';

// Every community call to the server, typed. Screens use these instead of raw paths.

export const communityApi = {
  // You
  setUsername: (username: string) =>
    api<{ user: ApiUser }>('/v1/me/username', { method: 'PUT', body: { username } }),
  updateProfile: (changes: { displayName?: string; bio?: string; isPrivate?: boolean }) =>
    api<{ user: ApiUser }>('/v1/me/profile', { method: 'PATCH', body: changes }),
  socialSettings: () => api<SocialSettingsDoc>('/v1/me/social-settings'),
  updateSocialSettings: (changes: Partial<SocialSettingsDoc> & { timezone?: string }) =>
    api<SocialSettingsDoc>('/v1/me/social-settings', { method: 'PATCH', body: changes }),
  privacyZones: () => api<{ zones: PrivacyZone[] }>('/v1/me/privacy-zones'),
  addPrivacyZone: (zone: Omit<PrivacyZone, 'id'>) =>
    api<PrivacyZone>('/v1/me/privacy-zones', { method: 'POST', body: zone }),
  deletePrivacyZone: (id: string) => api(`/v1/me/privacy-zones/${id}`, { method: 'DELETE' }),

  // People
  search: (query: string) =>
    api<{ users: PublicUser[] }>(`/v1/users/search?query=${encodeURIComponent(query)}`),
  profile: (id: string) => api<PublicProfile>(`/v1/users/${id}`),
  profileByUsername: (username: string) =>
    api<PublicProfile>(`/v1/users/by-username/${encodeURIComponent(username)}`),
  userWorkouts: (id: string) => api<FeedResponse>(`/v1/users/${id}/workouts`),
  followers: (id: string) => api<{ users: PublicUser[] }>(`/v1/users/${id}/followers`),
  following: (id: string) => api<{ users: PublicUser[] }>(`/v1/users/${id}/following`),
  follow: (id: string) => api<PublicProfile>(`/v1/users/${id}/follow`, { method: 'POST' }),
  unfollow: (id: string) => api(`/v1/users/${id}/follow`, { method: 'DELETE' }),
  removeFollower: (id: string) => api(`/v1/users/${id}/follower`, { method: 'DELETE' }),
  followRequests: () => api<{ users: PublicUser[] }>('/v1/me/follow-requests'),
  answerRequest: (id: string, accept: boolean) =>
    api(`/v1/me/follow-requests/${id}/${accept ? 'accept' : 'decline'}`, { method: 'POST' }),
  block: (id: string) => api(`/v1/users/${id}/block`, { method: 'POST' }),
  unblock: (id: string) => api(`/v1/users/${id}/block`, { method: 'DELETE' }),
  blocked: () => api<{ users: PublicUser[] }>('/v1/me/blocks'),

  // Feed, kudos, comments
  feed: (cursor?: string | null) =>
    api<FeedResponse>(`/v1/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),
  sharedWorkout: (id: string) => api<SharedWorkout>(`/v1/workouts/${id}`),
  giveKudos: (id: string) => api<SharedWorkout>(`/v1/workouts/${id}/kudos`, { method: 'POST' }),
  takeKudos: (id: string) => api<SharedWorkout>(`/v1/workouts/${id}/kudos`, { method: 'DELETE' }),
  comments: (id: string) => api<{ comments: WorkoutComment[] }>(`/v1/workouts/${id}/comments`),
  addComment: (id: string, body: string) =>
    api(`/v1/workouts/${id}/comments`, { method: 'POST', body: { body } }),
  deleteComment: (id: string) => api(`/v1/comments/${id}`, { method: 'DELETE' }),

  // Safety
  report: (targetType: ReportTarget, targetId: string, reason: ReportReason, details = '') =>
    api('/v1/reports', { method: 'POST', body: { targetType, targetId, reason, details } }),
  openReports: () =>
    api<{
      reports: {
        id: string;
        targetType: ReportTarget;
        targetId: string;
        reason: ReportReason;
        details: string;
        createdAt: number;
      }[];
    }>('/v1/admin/reports'),
  resolveReport: (id: string, action: 'dismiss' | 'hide' | 'suspend') =>
    api(`/v1/admin/reports/${id}`, { method: 'POST', body: { action } }),

  // Inbox and push
  inbox: () => api<{ items: InboxItem[]; unread: number }>('/v1/notifications'),
  markInboxRead: () => api('/v1/notifications/read', { method: 'POST' }),
  registerPushToken: (token: string) => api('/v1/push-tokens', { method: 'POST', body: { token } }),
  unregisterPushToken: (token: string) =>
    api('/v1/push-tokens', { method: 'DELETE', body: { token } }),

  // Clubs
  clubs: () => api<{ clubs: ClubSummary[] }>('/v1/clubs'),
  createClub: (name: string, description: string) =>
    api<ClubSummary>('/v1/clubs', { method: 'POST', body: { name, description } }),
  joinClub: (code: string) =>
    api<ClubSummary>('/v1/clubs/join', { method: 'POST', body: { code } }),
  club: (id: string) => api<{ club: ClubSummary; members: ClubMember[] }>(`/v1/clubs/${id}`),
  clubFeed: (id: string) => api<FeedResponse>(`/v1/clubs/${id}/feed`),
  newClubInvite: (id: string) => api<ClubSummary>(`/v1/clubs/${id}/invite`, { method: 'POST' }),
  setMemberRole: (clubId: string, userId: string, role: 'admin' | 'member') =>
    api(`/v1/clubs/${clubId}/members/${userId}`, { method: 'PATCH', body: { role } }),
  removeMember: (clubId: string, userId: string | 'me') =>
    api(`/v1/clubs/${clubId}/members/${userId}`, { method: 'DELETE' }),
  deleteClub: (id: string) => api(`/v1/clubs/${id}`, { method: 'DELETE' }),

  // Challenges
  challenges: () => api<{ challenges: ChallengeSummary[] }>('/v1/challenges'),
  publicChallenges: () => api<{ challenges: ChallengeSummary[] }>('/v1/challenges/public'),
  challenge: (id: string) =>
    api<{ challenge: ChallengeSummary; leaderboard: LeaderboardRow[] }>(`/v1/challenges/${id}`),
  createChallenge: (input: {
    title: string;
    kind: ChallengeKind;
    activityTypes: string[];
    targetDistanceM?: number | null;
    targetDurationS?: number | null;
    targetCount?: number | null;
    targetVolumeKg?: number | null;
    targetStrengthSessions?: number | null;
    startsAt: number;
    endsAt: number;
    timezone: string;
    clubId?: string | null;
    allowManual: boolean;
    isPublic: boolean;
  }) => api<ChallengeSummary>('/v1/challenges', { method: 'POST', body: input }),
  joinChallenge: (id: string) =>
    api<ChallengeSummary>(`/v1/challenges/${id}/join`, { method: 'POST' }),
  joinChallengeByCode: (code: string) =>
    api<ChallengeSummary>('/v1/challenges/join', { method: 'POST', body: { code } }),
  leaveChallenge: (id: string) => api(`/v1/challenges/${id}/join`, { method: 'DELETE' }),
  featureChallenge: (id: string, featured: boolean) =>
    api(`/v1/admin/challenges/${id}/feature`, { method: 'POST', body: { featured } }),
};
