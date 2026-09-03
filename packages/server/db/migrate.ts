// Standalone schema-migration runner for deploy-time use (Fly release_command).
// Applies the committed Drizzle migrations to the configured database without
// requiring drizzle-kit in the production image.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { getDatabaseEnv } from '../config/env.js';

const resolveMigrationsFolder = (): string => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const sourceLayout = path.join(here, 'migrations');
  if (fs.existsSync(sourceLayout)) {
    return sourceLayout;
  }
  return path.join(process.cwd(), 'packages/server/db/migrations');
};

const run = async (): Promise<void> => {
  const { DATABASE_URL, DATABASE_SSL, DATABASE_POOL_MAX } = getDatabaseEnv();
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: Math.max(DATABASE_POOL_MAX, 1),
    ssl: DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await migrate(drizzle(pool), { migrationsFolder: resolveMigrationsFolder() });
  } finally {
    await pool.end();
  }
};

run()
  .then(() => {
    console.log('[db:migrate] schema migrations applied');
  })
  .catch((error) => {
    console.error('[db:migrate] migration failed', error);
    process.exit(1);
  });
