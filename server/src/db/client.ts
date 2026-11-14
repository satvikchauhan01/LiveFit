import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { env } from '../env';
import * as schema from './schema';

// One connection pool for the whole server; queries borrow a connection and give it back.
export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });

export const db = drizzle(pool, { schema });

export type Database = typeof db;
/** A transaction handle, for functions that must run inside one. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
