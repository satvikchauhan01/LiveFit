import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

const sqlite = openDatabaseSync('livefit.db');
// WAL: reads don't block writes. foreign_keys: SQLite leaves them off unless asked.
sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });
