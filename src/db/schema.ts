import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// After changing this file, run `npm run db:generate` to create a new migration
// in /drizzle. The app applies pending migrations on startup.

/** Exactly one row (id = 1): the person using this phone. */
export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(),
  displayName: text('display_name').notNull().default(''),
  distanceUnit: text('distance_unit', { enum: ['km', 'mi'] })
    .notNull()
    .default('km'),
  weightUnit: text('weight_unit', { enum: ['kg', 'lb'] })
    .notNull()
    .default('kg'),
  /** Always stored in kilograms, whatever unit is shown. Null when not provided. */
  weightKg: real('weight_kg'),
  /** Unix ms when onboarding was finished; null means onboarding still needs to run. */
  onboardedAt: integer('onboarded_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type Profile = typeof profile.$inferSelect;

/** GPS activities recorded so far. Strength joins in Phase 4. */
export const ACTIVITY_TYPES = ['run', 'walk'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export function isActivityType(value: unknown): value is ActivityType {
  return ACTIVITY_TYPES.includes(value as ActivityType);
}

/**
 * One row per workout. While recording, `status` is 'active' and the summary
 * columns are empty; they are filled in when the workout is finished.
 */
export const workouts = sqliteTable(
  'workouts',
  {
    /** UUID made on the device, so it stays the same once synced to a server. */
    id: text('id').primaryKey(),
    type: text('type', { enum: ACTIVITY_TYPES }).notNull(),
    source: text('source', { enum: ['gps'] })
      .notNull()
      .default('gps'),
    status: text('status', { enum: ['active', 'finished'] }).notNull(),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
    /** IANA time zone where the workout started, e.g. "Asia/Kolkata". */
    timezone: text('timezone').notNull(),
    /** Wall-clock time from start to finish, pauses included. */
    elapsedS: integer('elapsed_s'),
    /** Time spent recording, pauses excluded. Pace is based on this. */
    movingS: integer('moving_s'),
    distanceM: real('distance_m'),
    title: text('title').notNull().default(''),
    notes: text('notes').notNull().default(''),
    /** Battery level (0–1) at start and finish, to measure battery use per hour. */
    batteryStart: real('battery_start'),
    batteryEnd: real('battery_end'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('workouts_status_idx').on(table.status),
    index('workouts_started_at_idx').on(table.startedAt),
  ],
);

export type Workout = typeof workouts.$inferSelect;

/** Every GPS fix, unfiltered. Keeping raw points means distance can be recalculated later. */
export const trackPoints = sqliteTable(
  'track_points',
  {
    id: integer('id').primaryKey(),
    workoutId: text('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'cascade' }),
    /** Unix ms from the GPS fix. */
    t: integer('t').notNull(),
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    alt: real('alt'),
    accuracyM: real('accuracy_m'),
    speedMps: real('speed_mps'),
    mocked: integer('mocked', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [index('track_points_workout_t_idx').on(table.workoutId, table.t)],
);

/** Pause intervals. `endedAt` is null while the workout is paused. */
export const workoutPauses = sqliteTable(
  'workout_pauses',
  {
    id: integer('id').primaryKey(),
    workoutId: text('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'cascade' }),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
  },
  (table) => [index('workout_pauses_workout_idx').on(table.workoutId)],
);

export type WorkoutPause = typeof workoutPauses.$inferSelect;
