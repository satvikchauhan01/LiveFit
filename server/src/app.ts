import express from 'express';
import helmet from 'helmet';

import { accountPages, accountRouter } from './account/routes';
import { analyticsRouter } from './analytics/routes';
import { authPages, authRouter } from './auth/routes';
import { errorHandler, notFound } from './lib/http';
import { syncRouter } from './sync/routes';

/** Builds the Express app. Feature routers are added in `registerFeatures`. */
export function createApp() {
  const app = express();

  // Behind a hosting provider's proxy, trust its X-Forwarded-For so rate limits
  // see real client addresses.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  // Workouts carry their whole route, so allow larger bodies than the default.
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/v1/auth', authRouter);
  app.use('/v1/me', accountRouter);
  app.use('/v1/sync', syncRouter);
  app.use('/v1/analytics', analyticsRouter);
  app.use(authPages);
  app.use(accountPages);

  return app;
}

/** Adds the final 404 and error handlers; call after every router is registered. */
export function finishApp(app: express.Express) {
  app.use(() => {
    throw notFound();
  });
  app.use(errorHandler);
  return app;
}
