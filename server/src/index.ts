import { createApp, finishApp } from './app';
import { pool } from './db/client';
import { env } from './env';
import { registerFeatures } from './features';

const app = createApp();
registerFeatures(app);
finishApp(app);

const server = app.listen(env.PORT, () => {
  console.log(`LiveFit server listening on port ${env.PORT}`);
});

// Hosts stop the old version with SIGTERM when a new one is deployed: finish
// the requests in flight and close the database pool, instead of cutting them off.
function shutDown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
  // Don't hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutDown('SIGTERM'));
process.on('SIGINT', () => shutDown('SIGINT'));
