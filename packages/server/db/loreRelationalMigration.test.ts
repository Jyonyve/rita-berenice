import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migrationSql = readFileSync(new URL('./migrations/0006_lore_relational_storage.sql', import.meta.url), 'utf8');

test('lore relational migration backfills legacy JSON before enforcing required columns', () => {
  const backfillIndex = migrationSql.indexOf('UPDATE "lores"');
  const titleConstraintIndex = migrationSql.indexOf('ALTER COLUMN "title" SET NOT NULL');
  const contentConstraintIndex = migrationSql.indexOf('ALTER COLUMN "content" SET NOT NULL');
  const dropLegacyDataIndex = migrationSql.indexOf('DROP COLUMN "data"');

  assert.match(migrationSql, /ADD COLUMN "title" text;/);
  assert.match(migrationSql, /ADD COLUMN "content" text;/);
  assert.ok(backfillIndex > -1);
  assert.ok(titleConstraintIndex > backfillIndex);
  assert.ok(contentConstraintIndex > backfillIndex);
  assert.ok(dropLegacyDataIndex > contentConstraintIndex);
});

test('lore relational migration preserves retrieval metadata and character links', () => {
  assert.match(migrationSql, /'retrievalEnabled'/);
  assert.match(migrationSql, /'keywordList'/);
  assert.match(migrationSql, /'topicList'/);
  assert.match(migrationSql, /'entityList'/);
  assert.match(migrationSql, /INSERT INTO "lore_character_links"/);
  assert.match(migrationSql, /'characterIds'/);
});
