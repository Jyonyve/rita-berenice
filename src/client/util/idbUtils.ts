// idbUtils.ts
import { openDB } from 'idb';
import { ChatTurn } from '@shared/domain/index.js';

const DB_NAME = 'ChatTurnDB';
const STORE_NAME = 'messages';

export const initDB = async () => {
	const db = await openDB(DB_NAME, 1, {
		upgrade(db) {
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, { keyPath: 'sequence' });
				store.createIndex('sequence', 'sequence');
			}
		},
	});
	return db;
};

export const getCachedMessages = async (
	beforeSequence: number,
	batchSize: number
): Promise<ChatTurn[]> => {
	const db = await initDB();
	const tx = db.transaction(STORE_NAME, 'readonly');
	const index = tx.store.index('sequence');
	const range = IDBKeyRange.upperBound(beforeSequence - 1);
	const result: ChatTurn[] = [];
	let cursor = await index.openCursor(range, 'prev');
	while (cursor && result.length < batchSize) {
		result.push(cursor.value as ChatTurn);
		cursor = await cursor.continue();
	}
	await tx.done;
	return result;
};

export const saveMessagesToCache = async (messages: ChatTurn[]) => {
	const db = await initDB();
	const tx = db.transaction(STORE_NAME, 'readwrite');
	for (const msg of messages) {
		await tx.store.put(msg);
	}
	await tx.done;
};

export const loadAllCachedMessages = async (): Promise<ChatTurn[]> => {
	const db = await initDB();
	const tx = db.transaction(STORE_NAME, 'readonly');
	const all = await tx.store.getAll();
	await tx.done;
	return all.sort((a, b) => b.sequence - a.sequence);
};
