import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import type { Visibility, WorkoutDetailDoc } from '../../../shared/api';

// After changing this file: `npm run db:generate`, then `npm run db:migrate`.

/** Unix ms, stored as a 64-bit integer and read back as a JS number. */
const ms = (name: string) => bigint(name, { mode: 'number' });

/**
 * Every synced row gets the next number from this sequence whenever it changes.
 * A phone remembers the highest number it has seen and asks only for newer rows,
 * which works no matter how the phone's clock is set.
 */
export const syncChangeSeq = pgSequence('sync_change_seq');
const changeSeq = () =>
  bigint('change_seq', { mode: 'number' })
    .notNull()
    .default(sql`nextval('sync_change_seq')`);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Always stored lower-case. */
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  displayName: text('display_name').notNull().default(''),
  /** Picked when joining the community (Release 3). */
  username: text('username').unique(),
  bio: text('bio').notNull().default(''),
  /** Private profiles approve each follower. */
  isPrivate: boolean('is_private').notNull().default(true),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  proUntil: timestamp('pro_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;

/**
 * Refresh tokens, stored only as hashes. Each sign-in starts a "family"; every
 * refresh replaces the token with a new one in the same family. If an old,
 * already-replaced token is used again, someone copied it, so the whole family
 * is revoked and that device has to sign in again.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('refresh_tokens_user_idx').on(table.userId)],
);

/** One-time links for verifying an email address and resetting a password. */
export const emailTokens = pgTable('email_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['verify_email', 'reset_password'] }).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Finished workouts, uploaded from phones. The id is the phone's UUID. */
export const workouts = pgTable(
  'workouts',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    source: text('source').notNull(),
    startedAt: ms('started_at').notNull(),
    endedAt: ms('ended_at'),
    timezone: text('timezone').notNull(),
    elapsedS: integer('elapsed_s'),
    movingS: integer('moving_s'),
    distanceM: doublePrecision('distance_m'),
    volumeKg: doublePrecision('volume_kg'),
    elevationGainM: doublePrecision('elevation_gain_m'),
    caloriesEst: doublePrecision('calories_est'),
    autoPause: boolean('auto_pause').notNull().default(false),
    title: text('title').notNull().default(''),
    notes: text('notes').notNull().default(''),
    visibility: text('visibility').$type<Visibility>().notNull().default('only_me'),
    extras: jsonb('extras').$type<Record<string, unknown>>().notNull().default({}),
    /** Points, pauses, laps and sets: written once, never changed. */
    detail: jsonb('detail').$type<WorkoutDetailDoc>().notNull(),
    /** The phone's last-edit time; the newer edit wins. */
    updatedAt: ms('updated_at').notNull(),
    deletedAt: ms('deleted_at'),
    changeSeq: changeSeq(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('workouts_user_seq_idx').on(table.userId, table.changeSeq),
    index('workouts_user_started_idx').on(table.userId, table.startedAt),
  ],
);

export type Workout = typeof workouts.$inferSelect;

/**
 * Small documents (profile settings, custom exercises, goals, routines, plan
 * enrolments), each stored whole. The newer `updated_at` wins.
 */
export const userDocs = pgTable(
  'user_docs',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    id: text('id').notNull(),
    body: jsonb('body').$type<Record<string, unknown>>().notNull(),
    updatedAt: ms('updated_at').notNull(),
    deleted: boolean('deleted').notNull().default(false),
    changeSeq: changeSeq(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.kind, table.id] }),
    index('user_docs_user_seq_idx').on(table.userId, table.changeSeq),
  ],
);

/** Product analytics: event names and a few numbers, never workout or location data. */
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** A random id per install, not linked to the account. */
    installId: text('install_id').notNull(),
    name: text('name').notNull(),
    props: jsonb('props').$type<Record<string, string | number | boolean>>().notNull().default({}),
    appVersion: text('app_version').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('analytics_events_name_idx').on(table.name, table.createdAt)],
);

// --- Community (Release 3) -------------------------------------------------------------

/** Private profiles turn follows into requests the owner approves. */
export const follows = pgTable(
  'follows',
  {
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followeeId: uuid('followee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['pending', 'accepted'] }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followeeId] }),
    index('follows_followee_idx').on(table.followeeId, table.status),
  ],
);

/** Blocking hides two people from each other everywhere. */
export const blocks = pgTable(
  'blocks',
  {
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.blockerId, table.blockedId] })],
);

/** Places where routes are cut before anyone else sees them (home, work). */
export const privacyZones = pgTable('privacy_zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  radiusM: integer('radius_m').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Per-user privacy and notification settings for the community. */
export const socialSettings = pgTable('social_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** Always cut the first and last 200 m of every shared route. */
  trimRouteEnds: boolean('trim_route_ends').notNull().default(true),
  /** Show stats only, never the route. */
  hideMaps: boolean('hide_maps').notNull().default(false),
  /** Show the date but not the time of day. */
  hideStartTime: boolean('hide_start_time').notNull().default(false),
  defaultVisibility: text('default_visibility').$type<Visibility>().notNull().default('only_me'),
  /** Which push notifications to send; the inbox always gets everything. */
  notifyFollows: boolean('notify_follows').notNull().default(true),
  notifyKudos: boolean('notify_kudos').notNull().default(true),
  notifyComments: boolean('notify_comments').notNull().default(true),
  notifyClubs: boolean('notify_clubs').notNull().default(true),
  notifyChallenges: boolean('notify_challenges').notNull().default(true),
  /** Quiet hours in minutes after midnight (in the timezone column); no pushes in between. */
  quietStart: integer('quiet_start'),
  quietEnd: integer('quiet_end'),
  timezone: text('timezone').notNull().default('UTC'),
});

export type SocialSettings = typeof socialSettings.$inferSelect;

/** What others may see of a workout: privacy-trimmed and simplified, computed on upload. */
export const workoutShares = pgTable('workout_shares', {
  workoutId: uuid('workout_id')
    .primaryKey()
    .references(() => workouts.id, { onDelete: 'cascade' }),
  /** [[lat, lng], ...] after privacy zones and end-trimming, or null when hidden. */
  route: jsonb('route').$type<[number, number][] | null>(),
  /** Fair-play checks (see verify.ts); only verified workouts count on leaderboards. */
  verified: boolean('verified').notNull().default(false),
  flags: jsonb('flags').$type<string[]>().notNull().default([]),
  /** Distance recomputed on the server from the raw points. */
  serverDistanceM: doublePrecision('server_distance_m'),
  /** Hidden by a moderator. */
  hidden: boolean('hidden').notNull().default(false),
});

export const kudos = pgTable(
  'kudos',
  {
    workoutId: uuid('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workoutId, table.userId] })],
);

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workoutId: uuid('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    hidden: boolean('hidden').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('comments_workout_idx').on(table.workoutId, table.createdAt)],
);

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  targetType: text('target_type', { enum: ['user', 'workout', 'comment', 'club'] }).notNull(),
  targetId: text('target_id').notNull(),
  reason: text('reason', {
    enum: ['spam', 'harassment', 'inappropriate', 'cheating', 'other'],
  }).notNull(),
  details: text('details').notNull().default(''),
  status: text('status', { enum: ['open', 'actioned', 'dismissed'] })
    .notNull()
    .default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const pushTokens = pgTable('push_tokens', {
  token: text('token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const NOTIFICATION_TYPES = [
  'follow',
  'follow_request',
  'follow_accepted',
  'kudos',
  'comment',
  'club_join',
  'challenge_started',
  'challenge_completed',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** The in-app inbox. */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type', { enum: NOTIFICATION_TYPES }).notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'cascade' }),
    workoutId: uuid('workout_id').references(() => workouts.id, { onDelete: 'cascade' }),
    clubId: uuid('club_id'),
    challengeId: uuid('challenge_id'),
    /** Kudos on one workout are grouped into one notification. */
    count: integer('count').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (table) => [index('notifications_user_idx').on(table.userId, table.createdAt)],
);

export const clubs = pgTable('clubs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  /** Anyone with the code (in an invite link) can join. */
  inviteCode: text('invite_code').notNull().unique(),
  hidden: boolean('hidden').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const clubMembers = pgTable(
  'club_members',
  {
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'admin', 'member'] }).notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.clubId, table.userId] }),
    index('club_members_user_idx').on(table.userId),
  ],
);

export const CHALLENGE_KINDS = ['distance', 'duration', 'count', 'volume', 'hybrid'] as const;

export const challenges = pgTable('challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** A club challenge, or null for a friends challenge joined by invite code. */
  clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'cascade' }),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  kind: text('kind', { enum: CHALLENGE_KINDS }).notNull(),
  /** Which activities count (empty = all of the kind's sort). */
  activityTypes: jsonb('activity_types').$type<string[]>().notNull().default([]),
  targetDistanceM: doublePrecision('target_distance_m'),
  targetDurationS: integer('target_duration_s'),
  targetCount: integer('target_count'),
  targetVolumeKg: doublePrecision('target_volume_kg'),
  /** Hybrid: strength sessions needed on top of the distance. */
  targetStrengthSessions: integer('target_strength_sessions'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  timezone: text('timezone').notNull(),
  /** Workout-count challenges may count hand-logged workouts if the creator allows. */
  allowManual: boolean('allow_manual').notNull().default(false),
  inviteCode: text('invite_code').notNull().unique(),
  /** Release 4: anyone can find and join public challenges; featured ones are promoted. */
  isPublic: boolean('is_public').notNull().default(false),
  featured: boolean('featured').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Challenge = typeof challenges.$inferSelect;

export const challengeParticipants = pgTable(
  'challenge_participants',
  {
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => challenges.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.challengeId, table.userId] }),
    index('challenge_participants_user_idx').on(table.userId),
  ],
);

// --- Advanced (Release 4) -----------------------------------------------------------------

/** A live link to a workout in progress, shared with chosen people. */
export const liveShares = pgTable('live_shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** The secret part of the link; only people who have it can see the position. */
  token: text('token').notNull().unique(),
  /**
   * Hash of the key the phone sends with each position. Kept apart from the
   * sign-in session so updates still work from the background GPS task.
   */
  writeKeyHash: text('write_key_hash').notNull(),
  activity: text('activity').notNull(),
  lastLat: doublePrecision('last_lat'),
  lastLng: doublePrecision('last_lng'),
  lastAt: timestamp('last_at', { withTimezone: true }),
  distanceM: doublePrecision('distance_m'),
  /** Recent positions as [lat, lng] pairs, so viewers see the way so far. Capped in size. */
  trail: jsonb('trail').$type<[number, number][]>().notNull().default([]),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  /** Links stop working after this even if the workout never ended cleanly. */
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

/** AI coach usage, for per-user limits and the monthly budget. */
export const coachUsage = pgTable(
  'coach_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    feature: text('feature').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    costUsd: doublePrecision('cost_usd').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('coach_usage_user_idx').on(table.userId, table.createdAt)],
);

/** LiveFit Pro purchases from Google Play, checked on the server. */
export const purchases = pgTable('purchases', {
  purchaseToken: text('purchase_token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  state: text('state').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
