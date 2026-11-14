import type { Equipment, Exercise, LogType, MuscleGroup } from '@/db/schema';

export type ExerciseDefinition = Pick<
  Exercise,
  'id' | 'name' | 'muscleGroup' | 'equipment' | 'logType'
>;

function lift(
  id: string,
  name: string,
  muscleGroup: MuscleGroup,
  equipment: Equipment,
  logType: LogType = equipment === 'bodyweight' ? 'reps' : 'weight_reps',
): ExerciseDefinition {
  return { id, name, muscleGroup, equipment, logType };
}

/**
 * The exercises every user starts with. They're copied into the database on
 * launch, so editing this list (fixing a name, adding a lift) reaches existing
 * installs with the next app update. Never change or reuse an `id`: past sets point to it.
 */
export const BUILT_IN_EXERCISES: ExerciseDefinition[] = [
  // Chest
  lift('bench-press', 'Bench Press', 'chest', 'barbell'),
  lift('incline-bench-press', 'Incline Bench Press', 'chest', 'barbell'),
  lift('dumbbell-bench-press', 'Dumbbell Bench Press', 'chest', 'dumbbell'),
  lift('incline-dumbbell-press', 'Incline Dumbbell Press', 'chest', 'dumbbell'),
  lift('dumbbell-fly', 'Dumbbell Fly', 'chest', 'dumbbell'),
  lift('cable-crossover', 'Cable Crossover', 'chest', 'cable'),
  lift('push-up', 'Push-up', 'chest', 'bodyweight'),
  lift('chest-dip', 'Dip', 'chest', 'bodyweight'),

  // Back
  lift('deadlift', 'Deadlift', 'back', 'barbell'),
  lift('barbell-row', 'Barbell Row', 'back', 'barbell'),
  lift('dumbbell-row', 'Dumbbell Row', 'back', 'dumbbell'),
  lift('lat-pulldown', 'Lat Pulldown', 'back', 'cable'),
  lift('seated-cable-row', 'Seated Cable Row', 'back', 'cable'),
  lift('pull-up', 'Pull-up', 'back', 'bodyweight'),
  lift('chin-up', 'Chin-up', 'back', 'bodyweight'),

  // Legs
  lift('back-squat', 'Back Squat', 'legs', 'barbell'),
  lift('front-squat', 'Front Squat', 'legs', 'barbell'),
  lift('romanian-deadlift', 'Romanian Deadlift', 'legs', 'barbell'),
  lift('hip-thrust', 'Hip Thrust', 'legs', 'barbell'),
  lift('goblet-squat', 'Goblet Squat', 'legs', 'dumbbell'),
  lift('lunge', 'Lunge', 'legs', 'dumbbell'),
  lift('bulgarian-split-squat', 'Bulgarian Split Squat', 'legs', 'dumbbell'),
  lift('leg-press', 'Leg Press', 'legs', 'machine'),
  lift('leg-extension', 'Leg Extension', 'legs', 'machine'),
  lift('leg-curl', 'Leg Curl', 'legs', 'machine'),
  lift('calf-raise', 'Calf Raise', 'legs', 'machine'),
  lift('bodyweight-squat', 'Bodyweight Squat', 'legs', 'bodyweight'),

  // Shoulders
  lift('overhead-press', 'Overhead Press', 'shoulders', 'barbell'),
  lift('dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 'shoulders', 'dumbbell'),
  lift('lateral-raise', 'Lateral Raise', 'shoulders', 'dumbbell'),
  lift('rear-delt-fly', 'Rear Delt Fly', 'shoulders', 'dumbbell'),
  lift('face-pull', 'Face Pull', 'shoulders', 'cable'),

  // Arms
  lift('barbell-curl', 'Barbell Curl', 'arms', 'barbell'),
  lift('dumbbell-curl', 'Dumbbell Curl', 'arms', 'dumbbell'),
  lift('hammer-curl', 'Hammer Curl', 'arms', 'dumbbell'),
  lift('triceps-pushdown', 'Triceps Pushdown', 'arms', 'cable'),
  lift('skull-crusher', 'Skull Crusher', 'arms', 'barbell'),
  lift('overhead-triceps-extension', 'Overhead Triceps Extension', 'arms', 'dumbbell'),
  lift('bench-dip', 'Bench Dip', 'arms', 'bodyweight'),

  // Core
  lift('plank', 'Plank', 'core', 'bodyweight', 'time'),
  lift('side-plank', 'Side Plank', 'core', 'bodyweight', 'time'),
  lift('hanging-leg-raise', 'Hanging Leg Raise', 'core', 'bodyweight'),
  lift('crunch', 'Crunch', 'core', 'bodyweight'),
  lift('ab-wheel-rollout', 'Ab Wheel Rollout', 'core', 'other', 'reps'),
  lift('russian-twist', 'Russian Twist', 'core', 'bodyweight'),

  // Full body
  lift('kettlebell-swing', 'Kettlebell Swing', 'full_body', 'kettlebell'),
  lift('power-clean', 'Power Clean', 'full_body', 'barbell'),
  lift('burpee', 'Burpee', 'full_body', 'bodyweight'),
];

export const MUSCLE_GROUP_LABEL: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  legs: 'Legs',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
  full_body: 'Full body',
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Cable',
  kettlebell: 'Kettlebell',
  bodyweight: 'Bodyweight',
  other: 'Other',
};

export const LOG_TYPE_LABEL: Record<LogType, string> = {
  weight_reps: 'Weight & reps',
  reps: 'Reps only',
  time: 'Time',
};
