import type Anthropic from '@anthropic-ai/sdk';
import { and, count, eq, gte, sum } from 'drizzle-orm';

import { db } from '../db/client';
import { coachUsage } from '../db/schema';
import { env } from '../env';
import { HttpError } from '../lib/http';

/** Coach requests each Pro member gets per calendar month. */
export const MONTHLY_REQUESTS_PER_USER = 100;

// Claude Opus 5.5 prices, US dollars per million tokens. Cache writes cost 1.25×
// input and cache reads 0.05×. If a refusal falls back to another model, its
// tokens are counted at these rates too: close enough for a budget cap.
const PRICE = { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 } as const;

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function costOf(usage: Anthropic.Beta.BetaUsage): number {
  return (
    (usage.input_tokens * PRICE.input +
      (usage.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
      usage.output_tokens * PRICE.output) /
    1_000_000
  );
}

/** Dollars spent on the coach this month, across everyone. */
async function monthlySpend(): Promise<number> {
  const [row] = await db
    .select({ total: sum(coachUsage.costUsd) })
    .from(coachUsage)
    .where(gte(coachUsage.createdAt, startOfMonth()));
  return Number(row?.total ?? 0);
}

export async function requestsThisMonth(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(coachUsage)
    .where(and(eq(coachUsage.userId, userId), gte(coachUsage.createdAt, startOfMonth())));
  return row?.total ?? 0;
}

export async function budgetLeft(): Promise<boolean> {
  return (await monthlySpend()) < env.COACH_MONTHLY_BUDGET_USD;
}

/** Throws when this person (or LiveFit as a whole) has used up this month's coach. */
export async function assertCoachAllowance(userId: string): Promise<void> {
  if (!(await budgetLeft())) {
    throw new HttpError(
      503,
      'coach_busy',
      'The coach has had a busy month and is resting. It’ll be back on the 1st.',
    );
  }
  if ((await requestsThisMonth(userId)) >= MONTHLY_REQUESTS_PER_USER) {
    throw new HttpError(
      429,
      'coach_limit',
      `You’ve used all ${MONTHLY_REQUESTS_PER_USER} coach requests this month.`,
    );
  }
}

export async function recordUsage(
  userId: string,
  feature: 'log' | 'ask',
  usage: Anthropic.Beta.BetaUsage,
): Promise<void> {
  await db.insert(coachUsage).values({
    userId,
    feature,
    inputTokens:
      usage.input_tokens +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0),
    outputTokens: usage.output_tokens,
    costUsd: costOf(usage),
  });
}
