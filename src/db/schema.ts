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
  /** Workouts per week that count towards the weekly streak. */
  weeklyGoal: integer('weekly_goal').notNull().default(3),
  /** Rest between strength sets, in seconds. */
  restSeconds: integer('rest_seconds').notNull().default(90),
  /** Stop the clock automatically when you stop moving during a run or walk. */
  autoPause: integer('auto_pause', { mode: 'boolean' }).notNull().default(true),
  /** Spoken updates at each km/mile and lap. */
  voiceCues: integer('voice_cues', { mode: 'boolean' }).notNull().default(true),
  /** Reminder days as ISO weekdays, comma-separated ("1,3,5" = Mon, Wed, Fri). Empty = off. */
  reminderDays: text('reminder_days').notNull().default(''),
  /** Reminder time as minutes after midnight (local time). */
  reminderMinutes: integer('reminder_minutes')
    .notNull()
    .default(18 * 60),
  /** Send anonymous usage events (feature names only) to help improve the app. */
  analyticsEnabled: integer('analytics_enabled', { mode: 'boolean' }).notNull().default(true),
  /** Changed since the last upload to the server. */
  dirty: integer('dirty', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type Profile = typeof profile.$inferSelect;

/** Activities recorded with GPS. */
export const GPS_ACTIVITY_TYPES = ['run', 'walk', 'cycle', 'hike', 'wheelchair'] as const;
export type GpsActivityType = (typeof GPS_ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPES = [...GPS_ACTIVITY_TYPES, 'strength'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export function isGpsActivityType(value: unknown): value is GpsActivityType {
  return GPS_ACTIVITY_TYPES.includes(value as GpsActivityType);
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
    /**
     * 'gps' recorded live with GPS; 'logged' a strength workout logged set by set;
     * 'manual' typed in afterwards; 'import' from a GPX file. Leaderboards trust
     * the first two more than the others.
     */
    source: text('source', { enum: ['gps', 'logged', 'manual', 'import'] })
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
    /** Strength: total of weight × reps over completed sets, in kg. */
    volumeKg: real('volume_kg'),
    /**
     * Whether auto-pause was on for this run or walk. Stored per workout so
     * changing the setting later doesn't change the numbers of old workouts.
     */
    autoPause: integer('auto_pause', { mode: 'boolean' }).notNull().default(false),
    title: text('title').notNull().default(''),
    notes: text('notes').notNull().default(''),
    /** Battery level (0–1) at start and finish, to measure battery use per hour. */
    batteryStart: real('battery_start'),
    batteryEnd: real('battery_end'),
    /** Climbing during the workout, from smoothed GPS altitude. */
    elevationGainM: real('elevation_gain_m'),
    /** Estimated calories (MET × weight × hours); always shown as an estimate. */
    caloriesEst: real('calories_est'),
    /** Who can see this workout once community features are on. */
    visibility: text('visibility', { enum: ['only_me', 'followers', 'club', 'public'] })
      .notNull()
      .default('only_me'),
    /** Extra computed values as JSON, e.g. best efforts: {"bestEfforts": {"5000": 1520000}}. */
    extras: text('extras').notNull().default('{}'),
    /** Changed since the last upload to the server. */
    dirty: integer('dirty', { mode: 'boolean' }).notNull().default(false),
    /** Deleted on this phone; kept until the server has heard about it. */
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('workouts_status_idx').on(table.status),
    index('workouts_started_at_idx').on(table.startedAt),
    index('workouts_dirty_idx').on(table.dirty),
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

/** Manual laps: the moments the Lap button was pressed. Auto splits are computed instead. */
export const workoutLaps = sqliteTable(
  'workout_laps',
  {
    id: integer('id').primaryKey(),
    workoutId: text('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'cascade' }),
    t: integer('t').notNull(),
  },
  (table) => [index('workout_laps_workout_idx').on(table.workoutId)],
);

export type WorkoutLap = typeof workoutLaps.$inferSelect;

// --- Strength -----------------------------------------------------------------

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'full_body',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'kettlebell',
  'bodyweight',
  'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

/** How sets of an exercise are logged: weight and reps, reps only, or a duration (planks). */
export const LOG_TYPES = ['weight_reps', 'reps', 'time'] as const;
export type LogType = (typeof LOG_TYPES)[number];

/**
 * Built-in exercises are copied in from code on every launch (see
 * features/strength/builtInExercises.ts); custom ones are made by the user.
 */
export const exercises = sqliteTable(
  'exercises',
  {
    /** Built-in: a readable slug like "bench-press". Custom: a UUID. */
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    muscleGroup: text('muscle_group', { enum: MUSCLE_GROUPS }).notNull(),
    equipment: text('equipment', { enum: EQUIPMENT }).notNull(),
    logType: text('log_type', { enum: LOG_TYPES }).notNull(),
    isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
    /** Custom exercises only: last edit, for syncing. */
    updatedAt: integer('updated_at').notNull().default(0),
    deletedAt: integer('deleted_at'),
    dirty: integer('dirty', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [index('exercises_name_idx').on(table.name)],
);

export type Exercise = typeof exercises.$inferSelect;

/**
 * One row per set. Exercises in a session are ordered by `exerciseOrder`, sets
 * within an exercise by `setIndex`. `completedAt` stays null until the set is ticked off.
 */
export const strengthSets = sqliteTable(
  'strength_sets',
  {
    id: integer('id').primaryKey(),
    workoutId: text('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id),
    exerciseOrder: integer('exercise_order').notNull(),
    setIndex: integer('set_index').notNull(),
    reps: integer('reps'),
    weightKg: real('weight_kg'),
    durationS: integer('duration_s'),
    completedAt: integer('completed_at'),
  },
  (table) => [
    index('strength_sets_workout_idx').on(table.workoutId),
    index('strength_sets_exercise_idx').on(table.exerciseId),
  ],
);

export type StrengthSet = typeof strengthSets.$inferSelect;

/** Small key/value settings for the sync engine (pull cursor, last sync time). */
export const syncState = sqliteTable('sync_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// --- Goals, routines and plans (Release 2) -------------------------------------------
// Each of these syncs as a small document, so they carry updatedAt / deletedAt / dirty.

export const GOAL_KINDS = [
  'workouts_week',
  'distance_week',
  'distance_month',
  'duration_week',
  'lift',
] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: GOAL_KINDS }).notNull(),
  /** Workouts, metres, seconds, or kg (a lift goal), depending on the kind. */
  target: real('target').notNull(),
  /** Distance goals can be for one activity (e.g. only rides); null = all cardio. */
  activityType: text('activity_type'),
  /** Lift goals: which exercise. */
  exerciseId: text('exercise_id'),
  /** The period (week/month key, or "done" for lifts) a "goal reached" alert was sent for. */
  lastAchievedPeriod: text('last_achieved_period'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  dirty: integer('dirty', { mode: 'boolean' }).notNull().default(false),
});

export type Goal = typeof goals.$inferSelect;

/** A saved strength workout to repeat: exercises with target sets, reps and weight. */
export const routines = sqliteTable('routines', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** JSON: [{ exerciseId, sets, reps, weightKg, durationS }]. */
  items: text('items').notNull().default('[]'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  dirty: integer('dirty', { mode: 'boolean' }).notNull().default(false),
});

export type Routine = typeof routines.$inferSelect;

/** Following a training plan (Couch to 5K, beginner strength…). One active at a time. */
export const planEnrollments = sqliteTable('plan_enrollments', {
  id: text('id').primaryKey(),
  planId: text('plan_id').notNull(),
  /** The Monday the plan started, "YYYY-MM-DD". */
  startWeek: text('start_week').notNull(),
  /** Set when finished or left. */
  endedAt: integer('ended_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
  dirty: integer('dirty', { mode: 'boolean' }).notNull().default(false),
});

export type PlanEnrollment = typeof planEnrollments.$inferSelect;
