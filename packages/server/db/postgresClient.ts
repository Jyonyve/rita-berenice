import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { getDatabaseEnv } from '../config/env.js';
import * as schema from './schema.js';

let pool: Pool | undefined;
let database: NodePgDatabase<typeof schema> | undefined;

export const getDatabase = (): NodePgDatabase<typeof schema> => {
	if (!database) {
		const env = getDatabaseEnv();
		pool = new Pool({
			connectionString: env.DATABASE_URL,
			max: env.DATABASE_POOL_MAX,
			ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
		});
		database = drizzle(pool, { schema });
	}
	return database;
};

export const closeDatabase = async (): Promise<void> => {
	await pool?.end();
	pool = undefined;
	database = undefined;
};
