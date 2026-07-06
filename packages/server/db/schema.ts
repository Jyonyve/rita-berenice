import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	vector,
} from 'drizzle-orm/pg-core';
import {
	CharacterInfo,
	ChatTurn,
	HistoryInfo,
	LoreInfo,
	ProfileInfo,
	RecapInfo,
	SessionInfo,
	CharacterTermInfo,
	SessionTermInfo,
	TempChatTurn,
	UserApiKeys,
	UserInfo,
} from '@rita-berenice/shared/domain';

const timestamps = {
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
};

export const users = pgTable(
	'users',
	{
		userId: text('user_id').primaryKey(),
		email: text('email').notNull(),
		showName: text('show_name').notNull(),
		data: jsonb('data').$type<UserInfo>().notNull(),
		...timestamps,
	},
	(table) => [
		uniqueIndex('users_email_unique').on(table.email),
		uniqueIndex('users_show_name_unique').on(table.showName),
	]
);

export const credentials = pgTable('credentials', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.userId, { onDelete: 'cascade' }),
	encryptedData: text('encrypted_data').notNull(),
	...timestamps,
});

export const characters = pgTable(
	'characters',
	{
		characterId: text('character_id').primaryKey(),
		userId: text('user_id').notNull(),
		showName: text('show_name').notNull(),
		data: jsonb('data').$type<CharacterInfo>().notNull(),
		...timestamps,
	},
	(table) => [
		index('characters_user_id_idx').on(table.userId),
		index('characters_show_name_idx').on(table.showName),
	]
);

export const sessions = pgTable(
	'sessions',
	{
		sessionId: text('session_id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.userId, { onDelete: 'cascade' }),
		characterId: text('character_id')
			.notNull()
			.references(() => characters.characterId, { onDelete: 'cascade' }),
		profileId: text('profile_id').notNull().default(''),
		status: text('status').notNull().default('active'),
		data: jsonb('data').$type<SessionInfo>().notNull(),
		...timestamps,
	},
	(table) => [
		index('sessions_user_id_idx').on(table.userId),
		index('sessions_character_id_idx').on(table.characterId),
	]
);

export const profiles = pgTable(
	'profiles',
	{
		profileId: text('profile_id').primaryKey(),
		sessionId: text('session_id')
			.notNull()
			.references(() => sessions.sessionId, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.userId, { onDelete: 'cascade' }),
		showName: text('show_name').notNull(),
		data: jsonb('data').$type<ProfileInfo>().notNull(),
		...timestamps,
	},
	(table) => [
		index('profiles_user_id_idx').on(table.userId),
		uniqueIndex('profiles_session_id_unique').on(table.sessionId),
	]
);

export const tempChatTurns = pgTable(
	'temp_chat_turns',
	{
		sessionId: text('session_id')
			.notNull()
			.references(() => sessions.sessionId, { onDelete: 'cascade' }),
		sequence: integer('sequence').notNull(),
		userId: text('user_id').notNull(),
		data: jsonb('data').$type<TempChatTurn>().notNull(),
		...timestamps,
	},
	(table) => [
		primaryKey({ columns: [table.sessionId, table.sequence] }),
		index('temp_chat_turns_user_id_idx').on(table.userId),
	]
);

export const chatTurns = pgTable(
	'chat_turns',
	{
		chatTurnId: text('chat_turn_id').primaryKey(),
		sessionId: text('session_id')
			.notNull()
			.references(() => sessions.sessionId, { onDelete: 'cascade' }),
		characterId: text('character_id').notNull(),
		profileId: text('profile_id').notNull(),
		userId: text('user_id').notNull(),
		sequence: integer('sequence').notNull(),
		data: jsonb('data').$type<ChatTurn>().notNull(),
		...timestamps,
	},
	(table) => [
		uniqueIndex('chat_turns_session_sequence_unique').on(table.sessionId, table.sequence),
		index('chat_turns_character_id_idx').on(table.characterId),
	]
);

export const lores = pgTable(
	'lores',
	{
		loreId: text('lore_id').primaryKey(),
		userId: text('user_id').notNull(),
		loreType: text('lore_type').notNull(),
		category: text('category').notNull(),
		data: jsonb('data').$type<LoreInfo>().notNull(),
		...timestamps,
	},
	(table) => [index('lores_user_id_idx').on(table.userId)]
);

export const histories = pgTable(
	'histories',
	{
		historyId: text('history_id').primaryKey(),
		characterId: text('character_id').notNull(),
		userId: text('user_id').notNull(),
		category: text('category').notNull(),
		data: jsonb('data').$type<HistoryInfo>().notNull(),
		...timestamps,
	},
	(table) => [index('histories_character_id_idx').on(table.characterId)]
);

export const recaps = pgTable(
	'recaps',
	{
		recapId: text('recap_id').primaryKey(),
		sessionId: text('session_id')
			.notNull()
			.references(() => sessions.sessionId, { onDelete: 'cascade' }),
		characterId: text('character_id').notNull(),
		userId: text('user_id').notNull(),
		recapType: text('recap_type').notNull(),
		turnStart: integer('turn_start').notNull(),
		turnEnd: integer('turn_end').notNull(),
		data: jsonb('data').$type<RecapInfo>().notNull(),
		...timestamps,
	},
	(table) => [index('recaps_session_type_idx').on(table.sessionId, table.recapType)]
);

export const terms = pgTable(
	'terms',
	{
		termId: text('term_id').primaryKey(),
		termType: text('term_type').notNull(),
		scopeId: text('scope_id').notNull(),
		characterId: text('character_id').notNull(),
		sessionId: text('session_id'),
		koreanTerm: text('korean_term').notNull(),
		englishTerm: text('english_term').notNull(),
		data: jsonb('data').$type<CharacterTermInfo | SessionTermInfo>().notNull(),
		...timestamps,
	},
	(table) => [
		index('terms_character_id_idx').on(table.characterId),
		index('terms_session_id_idx').on(table.sessionId),
		uniqueIndex('terms_scope_korean_unique').on(table.termType, table.scopeId, table.koreanTerm),
	]
);

export const finalizationJobs = pgTable(
	'finalization_jobs',
	{
		jobId: text('job_id').primaryKey(),
		sessionId: text('session_id').notNull(),
		sequence: integer('sequence').notNull(),
		status: text('status').notNull(),
		attempts: integer('attempts').notNull().default(0),
		maxAttempts: integer('max_attempts').notNull().default(3),
		input: jsonb('input').notNull(),
		result: jsonb('result').$type<ChatTurn>(),
		error: text('error'),
		lockedAt: timestamp('locked_at', { withTimezone: true, mode: 'string' }),
		...timestamps,
	},
	(table) => [
		index('finalization_jobs_status_idx').on(table.status, table.updatedAt),
		uniqueIndex('finalization_jobs_session_sequence_unique').on(table.sessionId, table.sequence),
	]
);

export const memoryEmbeddings = pgTable(
	'memory_embeddings',
	{
		embeddingId: text('embedding_id').primaryKey(),
		sourceType: text('source_type').notNull(),
		sourceId: text('source_id').notNull(),
		contentType: text('content_type').notNull(),
		userId: text('user_id').notNull(),
		characterId: text('character_id'),
		sessionId: text('session_id'),
		content: text('content').notNull(),
		contentHash: text('content_hash').notNull(),
		embeddingModel: text('embedding_model').notNull(),
		embeddingVersion: integer('embedding_version').notNull().default(1),
		embedding: vector('embedding', { dimensions: 1536 }).notNull(),
		metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
		active: boolean('active').notNull().default(true),
		...timestamps,
	},
	(table) => [
		index('memory_embeddings_source_idx').on(table.sourceType, table.sourceId),
		index('memory_embeddings_session_idx').on(table.sessionId),
		index('memory_embeddings_character_idx').on(table.characterId),
		index('memory_embeddings_hnsw_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
	]
);

export type DatabaseSchema = {
	users: typeof users;
	credentials: typeof credentials;
	characters: typeof characters;
	sessions: typeof sessions;
	profiles: typeof profiles;
	tempChatTurns: typeof tempChatTurns;
	chatTurns: typeof chatTurns;
	lores: typeof lores;
	histories: typeof histories;
	recaps: typeof recaps;
	terms: typeof terms;
	finalizationJobs: typeof finalizationJobs;
	memoryEmbeddings: typeof memoryEmbeddings;
};
