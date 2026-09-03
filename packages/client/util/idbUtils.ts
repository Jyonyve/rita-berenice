// src/client/util/idbUtils.ts

import { ChatTurn, DisplayTurn } from '@rita-berenice/shared/domain';
import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'ChatTurnDB';
const STORE_NAME = 'messages';
const VERSION = 2; // Increment DB version to trigger the upgrade

// Define a compound key for uniqueness
type MessageKey = [string, number]; // [sessionId, sequence]

export const initDB = async (): Promise<IDBPDatabase> => {
  const db = await openDB(DB_NAME, VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 2) {
        // Re-create the store with a compound key and a proper index
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        const store = db.createObjectStore(STORE_NAME, { keyPath: ['sessionId', 'sequence'] });
        // Create an index on sessionId to query by session
        store.createIndex('by-session', 'sessionId');
      }
    },
  });
  return db;
};

// Now accepts sessionId to fetch only relevant messages
export const getCachedMessages = async (
  sessionId: string,
  beforeSequence: number,
  batchSize: number,
): Promise<ChatTurn[]> => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const index = tx.store.index('by-session');
  // Query the index for the specific session, then sort by sequence manually
  const allMessagesForSession = await index.getAll(sessionId);

  // Filter and sort in memory
  const relevantMessages = allMessagesForSession
    .filter((msg) => msg.sequence < beforeSequence)
    .sort((a, b) => b.sequence - a.sequence)
    .slice(0, batchSize);

  await tx.done;
  return relevantMessages;
};

// No change needed here, as the keyPath is set on the object.
// The puts are issued together and awaited once at the end rather than one at a time: awaiting
// each put in turn serializes the whole batch, and a session's history can run to thousands of
// turns, all written while the user is looking at the freshly opened chat.
export const saveMessagesToCache = async (messages: DisplayTurn[]) => {
  if (messages.length === 0) return;
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const writes = messages.map((msg) => tx.store.put(msg));
  await Promise.all([...writes, tx.done]);
};

// This function is now session-specific
export const loadAllCachedMessagesForSession = async (sessionId: string): Promise<DisplayTurn[]> => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const index = tx.store.index('by-session');
  const all = await index.getAll(sessionId); // Use the index to get all messages for the session
  await tx.done;
  return all.sort((a, b) => b.sequence - a.sequence); // Sort by sequence descending
};

// Add a function to clear the cache for a specific session if needed
export const clearSessionCache = async (sessionId: string) => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const index = tx.store.index('by-session');
  let cursor = await index.openCursor(IDBKeyRange.only(sessionId));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
  console.log(`Cache cleared for session: ${sessionId}`);
};
