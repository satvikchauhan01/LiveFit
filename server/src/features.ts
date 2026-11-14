import type { Express } from 'express';

import { billingRouter, billingWebhooks } from './billing/routes';
import { coachRouter } from './coach/routes';
import { livePages, liveRouter } from './live/routes';

import { challengesRouter } from './community/challenges';
import { clubsRouter } from './community/clubs';
import { inboxRouter } from './community/inbox';
import { moderationRouter } from './community/moderation';
import { communityPages } from './community/pages';
import { peopleRouter } from './community/people';
import { socialRouter } from './community/social';
// Imported for its side effect: it keeps shared routes and fair-play checks up to date.
import './community/share';

/**
 * Community (Release 3) and advanced (Release 4) features plug in here, so the
 * core app in app.ts stays small.
 */
export function registerFeatures(app: Express): void {
  app.use('/v1', peopleRouter);
  app.use('/v1', socialRouter);
  app.use('/v1', moderationRouter);
  app.use('/v1', inboxRouter);
  app.use('/v1', clubsRouter);
  app.use('/v1', challengesRouter);
  app.use(communityPages);

  // Release 4
  app.use('/v1', coachRouter);
  app.use('/v1', liveRouter);
  app.use('/v1', billingRouter);
  app.use(billingWebhooks);
  app.use(livePages);
}
