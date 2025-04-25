// Save this file as scripts/initBatchChat.ts
import { ChromaClient, Collection } from 'chromadb';
import { COLLECTIONS, METADATA_TYPES } from '../src/shared/domain/chromadb/ChromaInterfaces.ts';
import { ChatMessage, ChatTurn, SUFFIX } from '../src/shared/domain/chat/ChatTypes.ts';
import { buildMessageId, buildTurnId } from '../src/shared/util/idUtils.ts';
import {
	rawInitialTurns, // Import the raw data
	sessionId as TARGET_SESSION_ID, // Import the target sessionId
	getTimestampForSequence, // Import helper for timestamps
} from './monday_origin_4addb91c-5733-4bf3-8142-a0ab98d0fd9e.ts'; // Adjust path

// --- Configuration ---
const CHROMA_URL = process.env.CHROMA_API_URL || 'https://chromadb-flyio.fly.dev'; // Use env var or default
const emotionDefault = 'default'; // Default emotion if not specified per turn

// --- Main Seeding Logic ---
async function initBatchChat() {
	console.log(`Connecting to ChromaDB at: ${CHROMA_URL}`);
	const chroma = new ChromaClient({ path: CHROMA_URL });

	const ids: string[] = []; // IDs for ChromaDB documents (turn IDs)
	const documents: string[] = []; // JSON strings of ChatTurn objects
	const metadatas: Record<string, string | number | boolean>[] = []; // Metadata for ChromaDB documents

	try {
		// 1. Get or Create the MAIN CHAT Collection
		console.log(`Ensuring main collection "${COLLECTIONS.CHAT}" exists...`);
		const collection: Collection = await chroma.getOrCreateCollection({
			name: COLLECTIONS.CHAT,
			metadata: {
				// Minimal, descriptive metadata for the collection itself
				description: 'Stores all chat session turns.',
				created_by_script: 'initBatchChat.ts',
			},
		});
		console.log(`Collection "${COLLECTIONS.CHAT}" ready.`);

		// 2. Prepare Data for Batch Upsert - Generate IDs and structure data
		console.log(
			`Preparing ${rawInitialTurns.length} chat turns for session "${TARGET_SESSION_ID}"...`
		);

		rawInitialTurns.forEach((rawTurn, index) => {
			const sequence = index; // Sequence is the loop index
			const timestamp = getTimestampForSequence(sequence); // Get staggered timestamp

			// Construct the Request object
			const requestMessage: ChatMessage = {
				role: 'user',
				messageId: buildMessageId(TARGET_SESSION_ID, sequence, 'request'),
				messageType: 'request',
				entries: [{ type: 'dialogue', prompt: rawTurn.requestPrompt }],
				emotion: emotionDefault, // Use default or add logic for specific emotions
				timestamp: timestamp,
			};

			// Construct the Response object
			const responseMessage: ChatMessage = {
				role: 'assistant',
				messageId: buildMessageId(TARGET_SESSION_ID, sequence, 'response'),
				messageType: 'response',
				entries: [{ type: 'dialogue', prompt: rawTurn.responsePrompt }],
				emotion: emotionDefault, // Use default or add logic
				timestamp: timestamp, // Typically response might have a slightly later timestamp, but using same for simplicity here
			};

			// Construct the full ChatTurn object
			const chatTurn: ChatTurn = {
				sessionId: TARGET_SESSION_ID,
				sequence: sequence,
				request: requestMessage,
				response: responseMessage,
				// Optional fields like modelUsed could be added if known
			};

			// --- Prepare for ChromaDB ---
			const turnId = buildTurnId(TARGET_SESSION_ID, sequence); // ID for the ChromaDB document
			const turnDocument = JSON.stringify(chatTurn); // Store the full turn object as a JSON string

			// Metadata for the ChromaDB document - aligns with chatService storage pattern
			const turnMetadata = {
				type: METADATA_TYPES.SET,
				sessionId: TARGET_SESSION_ID, // Essential for filtering
				sequence,
				timestamp, // Timestamp of the turn (using request time here)
			};

			ids.push(turnId);
			documents.push(turnDocument);
			metadatas.push(turnMetadata);
		}); // End of forEach loop

		// 3. Perform Batch Upsert (only if there's data to insert)
		if (ids.length === 0) {
			console.log(`No chat turns prepared for session ${TARGET_SESSION_ID}. Nothing to insert.`);
			return; // Exit if no data
		}

		console.log(`Upserting ${ids.length} documents into collection "${COLLECTIONS.CHAT}"...`);
		// Use the batch upsert method
		await collection.upsert({
			ids: ids,
			documents: documents,
			metadatas: metadatas,
			// Embeddings are omitted as we are storing the JSON string, not embedding it directly.
		});

		console.log(
			`Successfully seeded ${ids.length} initial chat turns for session ${TARGET_SESSION_ID} into collection "${COLLECTIONS.CHAT}".`
		);
	} catch (error) {
		console.error('Error seeding initial chat data:', error);
		process.exit(1); // Exit with error code
	}
}

// --- Run the script ---
initBatchChat();
