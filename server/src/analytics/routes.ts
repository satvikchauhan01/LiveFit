import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { db } from '../db/client';
import { analyticsEvents } from '../db/schema';
import { parse } from '../lib/http';

// Product analytics without a third party: the app sends anonymous event names
// (with a random install id, not the account) so you can see which features are
// used and how many people come back. Users can switch it off in Profile.

export const analyticsRouter = Router();

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 60 });

const eventSchema = z.object({
  name: z.string().regex(/^[a-z0-9_]{1,64}$/),
  props: z
    .record(z.string().max(40), z.union([z.string().max(100), z.number(), z.boolean()]))
    .default({}),
});

analyticsRouter.post('/events', limiter, async (req, res) => {
  const body = parse(
    z.object({
      installId: z.string().min(8).max(64),
      appVersion: z.string().max(20).default(''),
      events: z.array(eventSchema).max(50),
    }),
    req.body,
  );
  if (body.events.length > 0) {
    await db.insert(analyticsEvents).values(
      body.events.map((event) => ({
        installId: body.installId,
        appVersion: body.appVersion,
        name: event.name,
        props: event.props,
      })),
    );
  }
  res.status(204).end();
});
