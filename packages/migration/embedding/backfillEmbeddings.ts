import { createHash } from 'node:crypto';
import {
	chatTurns,
	closeDatabase,
	documents,
	getDatabase,
	histories,
	lores,
	memoryEmbeddings,
	recaps,
	sql,
} from '@rita-berenice/server/db';
import {
	chatTurnToDocument,
	historyToDocument,
	loreToDocument,
	recapToDocument,
} from '@rita-berenice/server/util';
import {
	documentToEmbeddingContent,
	documentToEmbeddingMetadata,
} from '@rita-berenice/server/store';
import { getConfiguredEmbeddingModel, replaceMemoryEmbedding } from '@rita-berenice/server/service';
import { Metadata } from '@rita-berenice/shared/api';
import { documentInfoSchema } from '@rita-berenice/shared/domain';
import {
	chatTurnToMetadata,
	historyToMetadata,
	loreToMetadata,
	recapToMetadata,
} from '@rita-berenice/shared/util';

/**
 * Backfills `memory_embeddings` for rows that were written straight to the
 * database rather than through the store layer — seeded demo data, most of all.
 *
 * The store layer creates embeddings as a side effect of every write. Anything
 * inserted around it (see demo/seedPublicDemo.ts) lands with no embedding at all,
 * which leaves both vector search and keyword search blind to it.
 *
 * Every content and metadata shape here comes from the same converters the stores
 * use. Nothing is reimplemented locally: an embedding written by this script has to
 * be indistinguishable from one the application would have written itself.
 */

const SOURCE_TYPES = ['chat', 'lore', 'history', 'recap', 'document'] as const;
type SourceType = (typeof SOURCE_TYPES)[number];

const args = process.argv.slice(2).filter((argument) => argument !== '--');
const apply = args.includes('--apply');

const getArg = (name: string): string | undefined => {
	const index = args.indexOf(`--${name}`);
	return index >= 0 ? args[index + 1] : undefined;
};

const userId = getArg('user-id');
const sessionId = getArg('session-id');
const maxArg = getArg('max');
const sourceArg = getArg('source');

if (!userId?.trim()) {
	throw new Error(
		'Usage: data:embedding:backfill -- --user-id <rita-user-id> [--session-id <id>] [--source chat,lore,...] [--max <n>] [--apply]'
	);
}

const max = maxArg === undefined ? Number.POSITIVE_INFINITY : Number.parseInt(maxArg, 10);
if (maxArg !== undefined && (!Number.isInteger(max) || max <= 0)) {
	throw new Error('--max requires a positive integer.');
}

const selectedSources: SourceType[] = sourceArg
	? sourceArg.split(',').map((value) => {
			const source = value.trim();
			if (!SOURCE_TYPES.includes(source as SourceType)) {
				throw new Error(`Unknown --source '${source}'. Expected one of: ${SOURCE_TYPES.join(', ')}.`);
			}
			return source as SourceType;
		})
	: [...SOURCE_TYPES];

interface BackfillTask {
	sourceType: SourceType;
	sourceId: string;
	contentType?: string;
	userId: string;
	characterId?: string;
	sessionId?: string;
	content: string;
	metadata: Metadata;
}

const db = getDatabase();
const embeddingModel = getConfiguredEmbeddingModel();

// Scope is always the owner; --session-id narrows it further for the tables that
// carry one. Session-less sources (lore, history) stay owner-scoped.
const ownerScope = sql`${sql.raw('user_id')} = ${userId}`;
const sessionScope = sessionId
	? sql`${ownerScope} and ${sql.raw('session_id')} = ${sessionId}`
	: ownerScope;

const collectTasks = async (): Promise<BackfillTask[]> => {
	const tasks: BackfillTask[] = [];

	if (selectedSources.includes('chat')) {
		const rows = await db.select({ data: chatTurns.data }).from(chatTurns).where(sessionScope);
		for (const { data: turn } of rows) {
			tasks.push({
				sourceType: 'chat',
				sourceId: turn.chatTurnId,
				userId: turn.userId,
				characterId: turn.characterId,
				sessionId: turn.sessionId,
				content: chatTurnToDocument(turn),
				metadata: chatTurnToMetadata(turn) as unknown as Metadata,
			});
		}
	}

	if (selectedSources.includes('lore')) {
		const rows = await db.select({ data: lores.data }).from(lores).where(ownerScope);
		for (const { data: lore } of rows) {
			tasks.push({
				sourceType: 'lore',
				sourceId: lore.loreId,
				userId: lore.userId,
				content: loreToDocument(lore),
				metadata: loreToMetadata(lore) as unknown as Metadata,
			});
		}
	}

	if (selectedSources.includes('history')) {
		const rows = await db.select({ data: histories.data }).from(histories).where(ownerScope);
		for (const { data: history } of rows) {
			tasks.push({
				sourceType: 'history',
				sourceId: history.historyId,
				userId: history.userId,
				characterId: history.characterId,
				content: historyToDocument(history),
				metadata: historyToMetadata(history) as unknown as Metadata,
			});
		}
	}

	if (selectedSources.includes('recap')) {
		const rows = await db.select({ data: recaps.data }).from(recaps).where(sessionScope);
		for (const { data: recap } of rows) {
			tasks.push({
				sourceType: 'recap',
				sourceId: recap.recapId,
				userId: recap.userId,
				characterId: recap.characterId,
				sessionId: recap.sessionId,
				content: recapToDocument(recap),
				metadata: recapToMetadata(recap) as unknown as Metadata,
			});
		}
	}

	if (selectedSources.includes('document')) {
		// Mirrors documentStore: only retrieval-enabled documents are ever embedded.
		const rows = await db
			.select({ data: documents.data })
			.from(documents)
			.where(sql`${sessionScope} and ${sql.raw('retrieval_enabled')} = true`);
		for (const row of rows) {
			const document = documentInfoSchema.parse(row.data);
			tasks.push({
				sourceType: 'document',
				sourceId: document.documentId,
				contentType: 'in-world-document',
				userId: document.userId,
				characterId: document.characterId,
				sessionId: document.sessionId,
				content: documentToEmbeddingContent(document),
				metadata: documentToEmbeddingMetadata(document) as unknown as Metadata,
			});
		}
	}

	return tasks;
};

/**
 * Mirrors the lookup inside `replaceMemoryEmbedding` so a dry run can report which
 * tasks would actually reach the embedding API. Read-only.
 */
const isAlreadyEmbedded = async (task: BackfillTask): Promise<boolean> => {
	const contentHash = createHash('sha256').update(task.content).digest('hex');
	const rows = await db
		.select({ embeddingId: memoryEmbeddings.embeddingId })
		.from(memoryEmbeddings)
		.where(
			sql`${memoryEmbeddings.sourceType} = ${task.sourceType}
				and ${memoryEmbeddings.sourceId} = ${task.sourceId}
				and ${memoryEmbeddings.contentHash} = ${contentHash}
				and ${memoryEmbeddings.embeddingModel} = ${embeddingModel}
				and ${memoryEmbeddings.active} = true`
		)
		.limit(1);
	return rows.length > 0;
};

const countBySource = (items: BackfillTask[]): Record<string, number> =>
	items.reduce<Record<string, number>>((counts, task) => {
		counts[task.sourceType] = (counts[task.sourceType] ?? 0) + 1;
		return counts;
	}, {});

try {
	const allTasks = await collectTasks();

	const pending: BackfillTask[] = [];
	const upToDate: BackfillTask[] = [];
	for (const task of allTasks) {
		((await isAlreadyEmbedded(task)) ? upToDate : pending).push(task);
	}

	const selected = pending.slice(0, Number.isFinite(max) ? max : undefined);

	const summary = {
		mode: apply ? 'apply' : 'dry-run',
		userId,
		sessionId: sessionId ?? null,
		embeddingModel,
		sources: selectedSources,
		max: Number.isFinite(max) ? max : null,
		found: { total: allTasks.length, bySource: countBySource(allTasks) },
		alreadyEmbedded: { total: upToDate.length, bySource: countBySource(upToDate) },
		wouldEmbed: { total: selected.length, bySource: countBySource(selected) },
		heldBackByMax: pending.length - selected.length,
		embeddingApiCalls: selected.length,
		targets: selected.map(({ sourceType, sourceId }) => ({ sourceType, sourceId })),
	};

	console.log(JSON.stringify(summary, null, 2));

	if (!apply) {
		if (allTasks.length === 0) {
			console.log('Dry run only. No rows matched the requested scope - nothing to embed.');
		} else if (selected.length === 0) {
			console.log('Dry run only. Every in-scope row already has a current embedding for this model.');
		} else {
			console.log(
				`Dry run only. Re-run with --apply to send ${selected.length} embedding request(s).`
			);
		}
	} else {
		let written = 0;
		for (const task of selected) {
			await replaceMemoryEmbedding(task);
			written += 1;
		}
		console.log(JSON.stringify({ mode: 'apply', written, skipped: upToDate.length }, null, 2));
	}
} finally {
	await closeDatabase();
}
