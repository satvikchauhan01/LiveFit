import type { ActivityType } from '@/db/schema';

// Built-in training plans. A plan is a list of weeks; each week is a list of
// sessions to do in any order that week. Sessions are ticked off by the
// workouts you actually record, so there's nothing to mark by hand.

export type RoutineItem = {
  exerciseId: string;
  sets: number;
  reps: number | null;
  weightKg: number | null;
  durationS: number | null;
};

export type PlanSession = {
  type: ActivityType;
  title: string;
  description: string;
  /** Strength sessions: the exercises to load into the workout. */
  routine?: RoutineItem[];
};

export type TrainingPlan = {
  id: string;
  name: string;
  summary: string;
  /** Suggested ISO weekdays for the sessions (1 = Monday), used for reminders. */
  suggestedDays: number[];
  weeks: PlanSession[][];
};

const lift = (exerciseId: string, sets: number, reps: number): RoutineItem => ({
  exerciseId,
  sets,
  reps,
  weightKg: null,
  durationS: null,
});
const hold = (exerciseId: string, sets: number, seconds: number): RoutineItem => ({
  exerciseId,
  sets,
  reps: null,
  weightKg: null,
  durationS: seconds,
});

const run = (title: string, description: string): PlanSession => ({
  type: 'run',
  title,
  description,
});
const times = <T>(count: number, make: () => T): T[] => Array.from({ length: count }, make);

const couchTo5k: TrainingPlan = {
  id: 'c25k',
  name: 'Couch to 5K',
  summary: 'From no running to 30 minutes non-stop in 9 weeks, three short runs a week.',
  suggestedDays: [1, 3, 6],
  weeks: [
    times(3, () => run('Week 1', 'Walk 5 min, then run 60 s / walk 90 s, 8 times.')),
    times(3, () => run('Week 2', 'Walk 5 min, then run 90 s / walk 2 min, 6 times.')),
    times(3, () =>
      run('Week 3', 'Walk 5 min, then twice: run 90 s, walk 90 s, run 3 min, walk 3 min.'),
    ),
    times(3, () =>
      run(
        'Week 4',
        'Walk 5 min. Run 3 min, walk 90 s, run 5 min, walk 2½ min, run 3 min, walk 90 s, run 5 min.',
      ),
    ),
    [
      run('Week 5 · run 1', 'Walk 5 min, then run 5 min / walk 3 min, 3 times.'),
      run('Week 5 · run 2', 'Walk 5 min, then run 8 min / walk 5 min, twice.'),
      run('Week 5 · run 3', 'Walk 5 min, then run 20 minutes without stopping.'),
    ],
    [
      run('Week 6 · run 1', 'Walk 5 min. Run 5 min, walk 3, run 8, walk 3, run 5.'),
      run('Week 6 · run 2', 'Walk 5 min. Run 10 min, walk 3 min, run 10 min.'),
      run('Week 6 · run 3', 'Walk 5 min, then run 25 minutes.'),
    ],
    times(3, () => run('Week 7', 'Walk 5 min, then run 25 minutes.')),
    times(3, () => run('Week 8', 'Walk 5 min, then run 28 minutes.')),
    times(3, () => run('Week 9', 'Walk 5 min, then run 30 minutes. That’s 5K for most people!')),
  ],
};

const strengthA: PlanSession = {
  type: 'strength',
  title: 'Workout A',
  description: 'Squat, bench press and barbell row: 3 sets of 5.',
  routine: [lift('back-squat', 3, 5), lift('bench-press', 3, 5), lift('barbell-row', 3, 5)],
};
const strengthB: PlanSession = {
  type: 'strength',
  title: 'Workout B',
  description: 'Squat and overhead press 3 × 5, then deadlift 1 × 5.',
  routine: [lift('back-squat', 3, 5), lift('overhead-press', 3, 5), lift('deadlift', 1, 5)],
};

const beginnerStrength: TrainingPlan = {
  id: 'beginner-strength',
  name: 'Beginner strength (3 days)',
  summary:
    'Full-body barbell training, three days a week for 8 weeks. Add a little weight each session while the reps stay clean.',
  suggestedDays: [1, 3, 5],
  weeks: times(8, () => null).map((_, week) =>
    week % 2 === 0 ? [strengthA, strengthB, strengthA] : [strengthB, strengthA, strengthB],
  ),
};

const hybridStrength1: PlanSession = {
  type: 'strength',
  title: 'Full body 1',
  description: 'Goblet squat, push-up, dumbbell row (3 × 10) and a plank.',
  routine: [
    lift('goblet-squat', 3, 10),
    lift('push-up', 3, 10),
    lift('dumbbell-row', 3, 10),
    hold('plank', 3, 45),
  ],
};
const hybridStrength2: PlanSession = {
  type: 'strength',
  title: 'Full body 2',
  description: 'Romanian deadlift, shoulder press, lat pulldown and lunges.',
  routine: [
    lift('romanian-deadlift', 3, 8),
    lift('dumbbell-shoulder-press', 3, 10),
    lift('lat-pulldown', 3, 10),
    lift('lunge', 3, 10),
  ],
};

const hybridStarter: TrainingPlan = {
  id: 'hybrid-starter',
  name: 'Hybrid starter',
  summary: 'Two easy runs and two full-body strength sessions a week, for 8 weeks.',
  suggestedDays: [1, 2, 4, 6],
  weeks: times(8, () => null).map((_, week) => {
    const minutes = 20 + Math.min(week, 6) * 2.5;
    return [
      hybridStrength1,
      run('Easy run', `Run ${Math.round(minutes)} minutes at a pace where you could still talk.`),
      hybridStrength2,
      run('Longer run', `Run ${Math.round(minutes + 5)} minutes, slowly. Walking breaks are fine.`),
    ];
  }),
};

export const PLANS: TrainingPlan[] = [couchTo5k, beginnerStrength, hybridStarter];

export function planById(id: string): TrainingPlan | undefined {
  return PLANS.find((plan) => plan.id === id);
}

/** Running sessions can be done as a run or a walk-run; anything else must match. */
function sessionMatches(session: PlanSession, workoutType: ActivityType): boolean {
  if (session.type === 'run') return workoutType === 'run' || workoutType === 'walk';
  return session.type === workoutType;
}

/**
 * Which of a week's sessions are done, given the workout types recorded that
 * week. Each workout ticks off at most one session, first match wins.
 */
export function sessionsDone(sessions: PlanSession[], workoutTypes: ActivityType[]): boolean[] {
  const unused = [...workoutTypes];
  return sessions.map((session) => {
    const index = unused.findIndex((type) => sessionMatches(session, type));
    if (index < 0) return false;
    unused.splice(index, 1);
    return true;
  });
}
