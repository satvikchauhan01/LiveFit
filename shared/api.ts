// The contract between the app and the LiveFit server. Types only (no runtime
// code), so both sides can import this file without pulling anything in.
// Times are Unix milliseconds throughout, the same as in the app's database.

export type Visibility = 'only_me' | 'followers' | 'club' | 'public';

export type ApiUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  /** Chosen when joining the community features (Release 3). */
  username: string | null;
  isPrivate: boolean;
  /** LiveFit Pro is active until this time, or null. */
  proUntil: number | null;
  /** Moderators see the report queue. */
  isAdmin: boolean;
  createdAt: number;
};

export type AuthResponse = {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
};

export type ApiErrorBody = {
  error: { code: string; message: string };
};

// --- Sync ---------------------------------------------------------------------------

/** One GPS fix, packed as an array to keep uploads small: [t, lat, lng, alt, accuracy, speed, mocked]. */
export type PackedPoint = [
  number,
  number,
  number,
  number | null,
  number | null,
  number | null,
  0 | 1,
];

export type StrengthSetDoc = {
  exerciseId: string;
  exerciseOrder: number;
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  durationS: number | null;
  completedAt: number | null;
};

/** The parts of a workout that never change after it's finished. */
export type WorkoutDetailDoc = {
  points: PackedPoint[];
  pauses: { startedAt: number; endedAt: number | null }[];
  laps: number[];
  sets: StrengthSetDoc[];
};

/**
 * A finished workout as it travels between phone and server. The id is the
 * UUID made on the phone, so uploading the same workout twice never creates a
 * duplicate. Only title, notes and visibility can change later.
 */
export type WorkoutDoc = {
  id: string;
  type: string;
  source: string;
  startedAt: number;
  endedAt: number | null;
  timezone: string;
  elapsedS: number | null;
  movingS: number | null;
  distanceM: number | null;
  volumeKg: number | null;
  elevationGainM: number | null;
  caloriesEst: number | null;
  autoPause: boolean;
  title: string;
  notes: string;
  visibility: Visibility;
  /** Best efforts and other per-workout extras, as stored on the phone. */
  extras: Record<string, unknown>;
  updatedAt: number;
  detail: WorkoutDetailDoc;
};

/** Small user data synced as whole documents, last write wins. */
export type SyncDocKind = 'profile' | 'exercise' | 'goal' | 'routine' | 'plan_enrollment';

export type SyncDoc = {
  kind: SyncDocKind;
  id: string;
  body: Record<string, unknown>;
  updatedAt: number;
  deleted: boolean;
};

export type PushRequest = {
  workouts: WorkoutDoc[];
  deletedWorkouts: { id: string; deletedAt: number }[];
  docs: SyncDoc[];
};

export type PushResponse = {
  /** Workout ids the server stored (or already had). */
  savedWorkoutIds: string[];
};

export type PullResponse = {
  workouts: WorkoutDoc[];
  deletedWorkoutIds: string[];
  docs: SyncDoc[];
  /** Pass back on the next pull to get only what changed since. */
  cursor: string;
  hasMore: boolean;
};

// --- Community (Release 3) -----------------------------------------------------------

export type FollowState = 'none' | 'pending' | 'following';

export type PublicUser = {
  id: string;
  username: string;
  displayName: string;
};

export type PublicProfile = PublicUser & {
  bio: string;
  isPrivate: boolean;
  /** How the viewer relates to this person. */
  followState: FollowState;
  /** Whether they follow the viewer. */
  followsYou: boolean;
  followers: number;
  following: number;
  /** False for a private profile you don't follow: only the name is shown then. */
  canSeeWorkouts: boolean;
  isMe: boolean;
  blocked: boolean;
};

/** A workout as other people see it: summary numbers and a privacy-trimmed route. */
export type SharedWorkout = {
  id: string;
  owner: PublicUser;
  type: string;
  title: string;
  /** Null when the owner hides the time of day (the date is still shown). */
  startedAt: number;
  showTime: boolean;
  timezone: string;
  movingS: number | null;
  distanceM: number | null;
  volumeKg: number | null;
  elevationGainM: number | null;
  /** [[lat, lng], …], or null when the owner hides maps. */
  route: [number, number][] | null;
  visibility: Visibility;
  kudos: number;
  hasKudoed: boolean;
  comments: number;
  verified: boolean;
};

export type FeedResponse = { items: SharedWorkout[]; nextCursor: string | null };

export type WorkoutComment = {
  id: string;
  user: PublicUser;
  body: string;
  createdAt: number;
  canDelete: boolean;
};

export type SocialSettingsDoc = {
  trimRouteEnds: boolean;
  hideMaps: boolean;
  hideStartTime: boolean;
  defaultVisibility: Visibility;
  notifyFollows: boolean;
  notifyKudos: boolean;
  notifyComments: boolean;
  notifyClubs: boolean;
  notifyChallenges: boolean;
  quietStart: number | null;
  quietEnd: number | null;
};

export type PrivacyZone = { id: string; lat: number; lng: number; radiusM: number };

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'cheating' | 'other';
export type ReportTarget = 'user' | 'workout' | 'comment' | 'club';

export type InboxItem = {
  id: string;
  type:
    | 'follow'
    | 'follow_request'
    | 'follow_accepted'
    | 'kudos'
    | 'comment'
    | 'club_join'
    | 'challenge_started'
    | 'challenge_completed';
  actor: PublicUser | null;
  workoutId: string | null;
  clubId: string | null;
  challengeId: string | null;
  count: number;
  createdAt: number;
  read: boolean;
};

export type ClubRole = 'owner' | 'admin' | 'member';

export type ClubSummary = {
  id: string;
  name: string;
  description: string;
  members: number;
  role: ClubRole | null;
  inviteCode: string | null;
};

export type ClubMember = PublicUser & { role: ClubRole };

export type ChallengeKind = 'distance' | 'duration' | 'count' | 'volume' | 'hybrid';

export type ChallengeSummary = {
  id: string;
  title: string;
  kind: ChallengeKind;
  activityTypes: string[];
  targetDistanceM: number | null;
  targetDurationS: number | null;
  targetCount: number | null;
  targetVolumeKg: number | null;
  targetStrengthSessions: number | null;
  startsAt: number;
  endsAt: number;
  timezone: string;
  clubId: string | null;
  isPublic: boolean;
  featured: boolean;
  participants: number;
  joined: boolean;
  inviteCode: string | null;
  allowManual: boolean;
};

export type LeaderboardRow = {
  user: PublicUser;
  /** Progress towards the target, 0–1 (hybrid: the lower of its two parts). */
  progress: number;
  distanceM: number;
  durationS: number;
  count: number;
  volumeKg: number;
  strengthSessions: number;
  completed: boolean;
};

// --- Advanced (Release 4) ------------------------------------------------------------

/** A live location link was made. `writeKey` lets the phone post positions; never share it. */
export type LiveShareStart = { id: string; url: string; expiresAt: number; writeKey: string };

export type CoachStatus = {
  /** False when the server has no Claude API key, or this month's budget is used up. */
  available: boolean;
  isPro: boolean;
  /** Coach requests used this month, and the monthly allowance. */
  used: number;
  limit: number;
};

/** What the app sends the coach about your training: numbers only, never routes or places. */
export type CoachTrainingSummary = {
  units: { distance: 'km' | 'mi'; weight: 'kg' | 'lb' };
  weeklyGoal: number;
  /** Most recent week first. */
  weeks: { weekStart: string; workouts: number; distanceM: number; movingS: number; volumeKg: number }[];
  /** Most recent workout first. */
  recent: {
    date: string;
    type: string;
    title: string;
    distanceM: number | null;
    movingS: number | null;
    volumeKg: number | null;
    elevationGainM: number | null;
    exercises: string[];
  }[];
  goals: string[];
  plan: string | null;
};

export type CoachLogSet = { reps: number | null; weightKg: number | null; durationS: number | null };

export type CoachLogResult = {
  exercises: { name: string; exerciseId: string | null; sets: CoachLogSet[] }[];
};

export type CoachTextResult = { text: string };

export type ProStatus = { isPro: boolean; proUntil: number | null };
