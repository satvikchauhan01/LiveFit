import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { db, pool } from './client';

// Applies any migrations in server/drizzle that the database hasn't seen yet.
// Run it before starting a new version of the server: `npm run db:migrate`.
await migrate(db, { migrationsFolder: 'drizzle' });
console.log('Database is up to date.');
await pool.end();
