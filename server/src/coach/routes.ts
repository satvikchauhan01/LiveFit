import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import type {
  CoachLogResult,
  CoachStatus,
  CoachTextResult,
  CoachTrainingSummary,
} from '../../../shared/api';
import { currentUser, requireAuth } from '../auth/middleware';
import { isPro, requirePro } from '../billing/pro';
import { env } from '../env';
import { HttpError, parse } from '../lib/http';
import {
  assertCoachAllowance,
  budgetLeft,
  MONTHLY_REQUESTS_PER_USER,
  recordUsage,
  requestsThisMonth,
} from './budget';

// The AI coach (LiveFit Pro). Two jobs:
//   - turn a typed note ("bench 3x8 at 60, squats 5x5 100") into sets to log;
//   - answer questions about your training, from a summary the app sends.
// Only numbers and exercise names are sent: never routes, places or times of day.

export const coachRouter = Router();
coachRouter.use(requireAuth);
coachRouter.use(
  rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => currentUser(req).id,
  }),
);

const MODEL = 'claude-opus-5-5';

let client: Anthropic | null = null;
function claude(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new HttpError(503, 'coach_off', 'The coach isn’t switched on for this server.');
  }
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 1 });
  return client;
}

function declined(): HttpError {
  return new HttpError(422, 'coach_declined', 'The coach can’t help with that one. Try asking another way.');
}

/** Claude API failures become friendly messages; the details go to the server log. */
function apiFailure(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  console.error('[coach] Claude API error', error);
  if (error instanceof Anthropic.RateLimitError) {
    return new HttpError(503, 'coach_busy', 'The coach is busy right now. Try again in a minute.');
  }
  return new HttpError(502, 'coach_unavailable', 'The coach couldn’t answer just now. Try again soon.');
}

coachRouter.get('/coach/status', async (req, res) => {
  const me = currentUser(req);
  const status: CoachStatus = {
    available: Boolean(env.ANTHROPIC_API_KEY) && (await budgetLeft()),
    isPro: isPro(me.proUntil),
    used: await requestsThisMonth(me.id),
    limit: MONTHLY_REQUESTS_PER_USER,
  };
  res.json(status);
});

// --- Logging sets from a typed note ---------------------------------------------------

const LOG_SYSTEM = `You turn a gym-goer's quick note into structured strength sets for the LiveFit app.

Rules:
- Each exercise gets one entry, with one item per set. "3x8 at 60" means three sets of 8 reps at 60.
- Weights go in kilograms. The person's usual unit is given; numbers without a unit are in that unit. Convert pounds to kilograms (1 lb = 0.4536 kg), rounded to 0.5 kg.
- Bodyweight exercises have weightKg null. Timed holds (plank, wall sit) use durationS and reps null.
- Match each exercise to the closest one in the provided list and copy its id exactly into exerciseId. If nothing in the list is clearly the same movement, set exerciseId to null and give a short, plain name.
- Ignore anything that isn't a strength exercise. If the note contains no exercises, return an empty list.`;

const LogOutput = z.object({
  exercises: z.array(
    z.object({
      name: z.string(),
      exerciseId: z.string().nullable(),
      sets: z.array(
        z.object({
          reps: z.number().int().nullable(),
          weightKg: z.number().nullable(),
          durationS: z.number().int().nullable(),
        }),
      ),
    }),
  ),
});

const logRequest = z.object({
  text: z.string().trim().min(2).max(1000),
  weightUnit: z.enum(['kg', 'lb']),
  exercises: z
    .array(z.object({ id: z.string().max(64), name: z.string().max(80) }))
    .max(400),
});

coachRouter.post('/coach/log', async (req, res) => {
  const me = currentUser(req);
  requirePro(me, 'The AI coach');
  const body = parse(logRequest, req.body);
  await assertCoachAllowance(me.id);

  const exerciseList = body.exercises.map((exercise) => `${exercise.id}: ${exercise.name}`).join('\n');
  let response;
  try {
    response = await claude().beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      // Opus 5.5 can decline a request for safety reasons; this lets the API
      // retry it on its recommended fallback model inside the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // A small, well-defined job: little thinking needed.
      output_config: { effort: 'low', format: betaZodOutputFormat(LogOutput) },
      system: LOG_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Usual weight unit: ${body.weightUnit}\n\nExercise list (id: name):\n${exerciseList}\n\nNote:\n${body.text}`,
        },
      ],
    });
  } catch (error) {
    throw apiFailure(error);
  }
  await recordUsage(me.id, 'log', response.usage);
  if (response.stop_reason === 'refusal') throw declined();
  const parsed = response.parsed_output;
  if (!parsed) {
    throw new HttpError(502, 'coach_unavailable', 'The coach got muddled. Try writing it another way.');
  }

  // Only ids the app actually sent are kept.
  const known = new Set(body.exercises.map((exercise) => exercise.id));
  const result: CoachLogResult = {
    exercises: parsed.exercises
      .filter((exercise) => exercise.sets.length > 0)
      .map((exercise) => ({
        name: exercise.name.slice(0, 80),
        exerciseId: exercise.exerciseId && known.has(exercise.exerciseId) ? exercise.exerciseId : null,
        sets: exercise.sets.slice(0, 20),
      }))
      .slice(0, 20),
  };
  res.json(result);
});

// --- Questions about your training ----------------------------------------------------

const ASK_SYSTEM = `You are the coach inside LiveFit, a fitness tracking app for running, walking, cycling, hiking, wheelchair pushing and strength training.

You answer the athlete's question using the training summary provided with it. Be specific to their numbers: mention actual distances, paces, weekly totals or weights when they help. Use the units the summary says they prefer (distances in the summary are in metres and times in seconds; convert them).

Guidelines:
- Be encouraging but honest. Favour safe, gradual progress (for example, about 10% more weekly distance at most).
- You are not a doctor. For pain, injury, illness, pregnancy, or anything medical, say so briefly and suggest seeing a qualified professional.
- If the summary doesn't contain what you'd need, say what's missing instead of guessing.
- Plain text only: no Markdown headings, tables or bold. Short paragraphs, or a few lines starting with "- " for steps. Aim for under 180 words.`;

const summarySchema = z.object({
  units: z.object({ distance: z.enum(['km', 'mi']), weight: z.enum(['kg', 'lb']) }),
  weeklyGoal: z.number().int().min(0).max(21),
  weeks: z
    .array(
      z.object({
        weekStart: z.string().max(12),
        workouts: z.number().int().min(0).max(100),
        distanceM: z.number().min(0),
        movingS: z.number().min(0),
        volumeKg: z.number().min(0),
      }),
    )
    .max(12),
  recent: z
    .array(
      z.object({
        date: z.string().max(12),
        type: z.string().max(20),
        title: z.string().max(80),
        distanceM: z.number().nullable(),
        movingS: z.number().nullable(),
        volumeKg: z.number().nullable(),
        elevationGainM: z.number().nullable(),
        exercises: z.array(z.string().max(80)).max(20),
      }),
    )
    .max(20),
  goals: z.array(z.string().max(120)).max(10),
  plan: z.string().max(120).nullable(),
}) satisfies z.ZodType<CoachTrainingSummary>;

const askRequest = z.object({
  question: z.string().trim().min(2).max(1000),
  summary: summarySchema,
});

coachRouter.post('/coach/ask', async (req, res) => {
  const me = currentUser(req);
  requirePro(me, 'The AI coach');
  const body = parse(askRequest, req.body);
  await assertCoachAllowance(me.id);

  let response;
  try {
    response = await claude().beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      // Opus 5.5 can decline a request for safety reasons; this lets the API
      // retry it on its recommended fallback model inside the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: ASK_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `My training summary (JSON):\n${JSON.stringify(body.summary)}\n\nMy question:\n${body.question}`,
        },
      ],
    });
  } catch (error) {
    throw apiFailure(error);
  }
  await recordUsage(me.id, 'ask', response.usage);
  if (response.stop_reason === 'refusal') throw declined();

  const text = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('\n')
    .trim();
  if (!text) {
    throw new HttpError(502, 'coach_unavailable', 'The coach couldn’t answer just now. Try again soon.');
  }
  const result: CoachTextResult = { text };
  res.json(result);
});
