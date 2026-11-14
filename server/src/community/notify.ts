import { and, eq, gt, inArray, isNull } from 'drizzle-orm';

import { db } from '../db/client';
import { notifications, type NotificationType, pushTokens, type SocialSettings, users } from '../db/schema';
import { getSocialSettings } from './share';

// Notifications go to two places:
// - the in-app inbox (always), stored in the notifications table;
// - a push notification on the phone, through Expo's push service, if the person
//   allows that kind and it isn't their quiet hours.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type NotifyInput = {
  userId: string;
  type: NotificationType;
  actorId?: string | null;
  workoutId?: string | null;
  clubId?: string | null;
  challengeId?: string | null;
};

const PUSH_SETTING: Record<NotificationType, keyof SocialSettings> = {
  follow: 'notifyFollows',
  follow_request: 'notifyFollows',
  follow_accepted: 'notifyFollows',
  kudos: 'notifyKudos',
  comment: 'notifyComments',
  club_join: 'notifyClubs',
  challenge_started: 'notifyChallenges',
  challenge_completed: 'notifyChallenges',
};

function inQuietHours(settings: SocialSettings, now = new Date()): boolean {
  if (settings.quietStart === null || settings.quietEnd === null) return false;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: settings.timezone,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  const minutes = hour * 60 + minute;
  const { quietStart: start, quietEnd: end } = settings;
  // Quiet hours can wrap past midnight (e.g. 22:00–07:00).
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

async function pushText(input: NotifyInput, count: number): Promise<{ title: string; body: string }> {
  const [actor] = input.actorId
    ? await db.select().from(users).where(eq(users.id, input.actorId))
    : [];
  const name = actor ? actor.displayName || `@${actor.username}` : 'Someone';
  switch (input.type) {
    case 'follow':
      return { title: 'New follower', body: `${name} started following you.` };
    case 'follow_request':
      return { title: 'Follow request', body: `${name} would like to follow you.` };
    case 'follow_accepted':
      return { title: 'Request accepted', body: `${name} accepted your follow request.` };
    case 'kudos':
      return {
        title: 'Kudos!',
        body: count > 1 ? `${name} and ${count - 1} others gave you kudos.` : `${name} gave you kudos.`,
      };
    case 'comment':
      return { title: 'New comment', body: `${name} commented on your workout.` };
    case 'club_join':
      return { title: 'Club', body: `${name} joined your club.` };
    case 'challenge_started':
      return { title: 'New challenge', body: 'A new challenge started in your club.' };
    case 'challenge_completed':
      return { title: 'Challenge complete!', body: 'You completed a challenge. Badge earned!' };
  }
}

export async function sendPush(userId: string, message: { title: string; body: string; data?: Record<string, unknown> }) {
  const tokens = await db.select().from(pushTokens).where(eq(pushTokens.userId, userId));
  if (tokens.length === 0) return;
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(
        tokens.map((token) => ({ to: token.token, sound: 'default', ...message })),
      ),
    });
    const result = (await response.json()) as {
      data?: { status: string; details?: { error?: string } }[];
    };
    // Forget tokens of uninstalled apps.
    const dead = (result.data ?? [])
      .map((ticket, i) => (ticket.details?.error === 'DeviceNotRegistered' ? tokens[i]?.token : null))
      .filter((token): token is string => Boolean(token));
    if (dead.length > 0) await db.delete(pushTokens).where(inArray(pushTokens.token, dead));
  } catch (error) {
    console.warn('[push] failed', error);
  }
}

/**
 * Adds a notification to someone's inbox and pushes it to their phone.
 * Kudos on the same workout within a day are grouped into one ("Sam and 3 others").
 */
export async function notify(input: NotifyInput): Promise<void> {
  if (input.actorId && input.actorId === input.userId) return; // never notify yourself

  let count = 1;
  if (input.type === 'kudos' && input.workoutId) {
    const [existing] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, input.userId),
          eq(notifications.type, 'kudos'),
          eq(notifications.workoutId, input.workoutId),
          isNull(notifications.readAt),
          gt(notifications.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        ),
      );
    if (existing) {
      count = existing.count + 1;
      await db
        .update(notifications)
        .set({ count, actorId: input.actorId ?? null, createdAt: new Date() })
        .where(eq(notifications.id, existing.id));
      return; // grouped: no extra push for every like
    }
  }

  await db.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    actorId: input.actorId ?? null,
    workoutId: input.workoutId ?? null,
    clubId: input.clubId ?? null,
    challengeId: input.challengeId ?? null,
    count,
  });

  const settings = await getSocialSettings(input.userId);
  if (!settings[PUSH_SETTING[input.type]] || inQuietHours(settings)) return;
  await sendPush(input.userId, {
    ...(await pushText(input, count)),
    data: {
      type: input.type,
      workoutId: input.workoutId ?? null,
      clubId: input.clubId ?? null,
      challengeId: input.challengeId ?? null,
    },
  });
}
