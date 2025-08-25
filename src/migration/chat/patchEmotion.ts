import { ChromaClient, Collection, Metadata } from 'chromadb';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { ChatEntry, ChatMessage } from '#shared/domain/chat/index.js';
import { EmotionValue } from '#shared/index.js';
import { chromaDbClient, parseConversationToEntries } from '#server/index.js';
import { parseTextToEntries } from 'src/client/util/chatParseUtils.ts';

/**
 * Filters out dialogue entries that have an empty or whitespace-only prompt.
 * @param entries An array of ChatEntry objects.
 * @returns A new array with the empty dialogue entries removed.
 */
function removeEmptyDialogueEntries(entries: ChatEntry[]): ChatEntry[] {
	return entries.filter((entry) => {
		// If the entry is a dialogue, check if its prompt has content
		if (entry.type === 'dialogue') {
			return entry.prompt.trim().length > 0;
		}
		// Always keep entries that are not of type 'dialogue'
		return true;
	});
}

/**
 * Corrects the 'emotion' field within the responseJson of a chat turn.
 * It ensures the emotion in the JSON string matches the 'characterEmotionPrimary' from the metadata.
 * @param sessionId The ID of the session to process.
 */
async function patchResponseJsonEmotion(sessionId: string): Promise<void> {
	console.log(`Starting responseJson emotion patch for session ID: ${sessionId}...`);

	const client = chromaDbClient;
	const collection = await client.getChatCollection();

	// 1. Fetch all primary turn documents for the session
	const response = await collection.get({
		where: { $and: [{ type: { $eq: METADATA_TYPES.TURN } }, { sessionId: { $eq: sessionId } }] },
		include: ['metadatas'], // Only need metadatas
	});

	if (!response.ids || response.ids.length === 0) {
		console.log('✅ No chat turns found to patch.');
		return;
	}

	console.log(`Found ${response.ids.length} chat turns to check.`);

	let updatedCount = 0;

	// 2. Iterate through each turn and check for inconsistencies
	for (let i = 0; i < response.ids.length; i++) {
		const id = response.ids[i];
		const metadata = response.metadatas[i] as Metadata;

		if (!metadata || !metadata.responseJson || typeof metadata.characterEmotionPrimary !== 'string') {
			console.warn(
				`Skipping turn ${id} due to missing metadata, responseJson, or characterEmotionPrimary.`
			);
			continue;
		}

		try {
			const responseMessage: ChatMessage = JSON.parse(metadata.responseJson as string);
			const correctEmotion = metadata.characterEmotionPrimary;

			// 3. If the emotion in the JSON is incorrect, update it
			if (responseMessage.emotion !== correctEmotion) {
				console.log(
					`Updating turn ${id}: responseJson emotion from '${responseMessage.emotion}' to '${correctEmotion}'`
				);

				// Update the emotion within the message object
				responseMessage.emotion = correctEmotion as EmotionValue;

				// Stringify the corrected object back to JSON
				const updatedResponseJson = JSON.stringify(responseMessage);

				// Prepare the new metadata for the update
				const newMetadata: Metadata = { ...metadata, responseJson: updatedResponseJson };

				// 4. Commit the single update
				await collection.update({ ids: [id], metadatas: [newMetadata] });

				updatedCount++;
			}
		} catch (error) {
			console.error(`Failed to process turn ${id}:`, error);
		}
	}

	if (updatedCount > 0) {
		console.log(`✅ Successfully updated ${updatedCount} chat turns.`);
	} else {
		console.log('✅ All chat turns already have correct emotions in their responseJson.');
	}
}

/**
 * Corrects chat turn entries and removes empty dialogues.
 * @param sessionId The ID of the session to process.
 */
export async function patchEntryAsterisk(sessionId: string): Promise<void> {
	console.log(`Starting entry patch for session ID: ${sessionId}...`);

	const client = chromaDbClient;
	const collection = await client.getChatCollection();

	// 1. Fetch all primary turn documents for the session
	const chatTurns = await collection.get({
		where: { $and: [{ type: { $eq: METADATA_TYPES.TURN } }, { sessionId: { $eq: sessionId } }] },
		include: ['metadatas'],
	});

	if (!chatTurns.ids || chatTurns.ids.length === 0) {
		console.log('✅ No chat turns found to patch.');
		return;
	}

	console.log(`Found ${chatTurns.ids.length} chat turns to check.`);

	const idsToUpdate: string[] = [];
	const metadatasToUpdate: Metadata[] = [];

	// 2. Iterate through each turn
	for (let i = 0; i < chatTurns.ids.length; i++) {
		const id = chatTurns.ids[i];
		const metadata = chatTurns.metadatas[i] as Metadata;
		let needsUpdate = false;

		if (!metadata || !metadata.requestJson || !metadata.responseJson) {
			console.warn(`Skipping turn ${id} due to missing JSON.`);
			continue;
		}

		try {
			const oldReq: ChatMessage = JSON.parse(metadata.requestJson as string);
			const oldRes: ChatMessage = JSON.parse(metadata.responseJson as string);

			let newReqEntries = oldReq.entries;
			let newResEntries = oldRes.entries;

			// Process request entries
			if (oldReq.entries.length === 1 && typeof oldReq.entries[0]?.prompt === 'string') {
				const prompt = oldReq.entries[0].prompt;
				const parsed = prompt.includes('*')
					? parseTextToEntries(prompt)
					: parseConversationToEntries(prompt);

				// ✅ Filter out empty dialogues after parsing
				const cleanedEntries = removeEmptyDialogueEntries(parsed);

				newReqEntries = cleanedEntries;
				needsUpdate = true;
			}

			// Process response entries
			if (oldRes.entries.length === 1 && typeof oldRes.entries[0]?.prompt === 'string') {
				const prompt = oldRes.entries[0].prompt;
				const parsed = prompt.includes('*')
					? parseTextToEntries(prompt)
					: parseConversationToEntries(prompt);

				// ✅ Filter out empty dialogues after parsing
				const cleanedEntries = removeEmptyDialogueEntries(parsed);

				newResEntries = cleanedEntries;
				needsUpdate = true;
			}

			if (needsUpdate) {
				const updatedRequestJson = JSON.stringify({ ...oldReq, entries: newReqEntries });
				const updatedResponseJson = JSON.stringify({ ...oldRes, entries: newResEntries });

				const newMetadata: Metadata = {
					...metadata,
					requestJson: updatedRequestJson,
					responseJson: updatedResponseJson,
				};

				idsToUpdate.push(id);
				metadatasToUpdate.push(newMetadata);
			}
		} catch (error) {
			console.error(`Failed to process turn ${id}:`, error);
		}
	}

	// 3. Perform the batch update
	if (idsToUpdate.length > 0) {
		console.log(`Updating ${idsToUpdate.length} chat turns in a single batch...`);
		await collection.update({
			ids: idsToUpdate,
			metadatas: metadatasToUpdate,
		});
		console.log(`✅ Successfully updated ${idsToUpdate.length} chat turns.`);
	} else {
		console.log('✅ No chat turns required updates.');
	}
}

// Get the session ID from command-line arguments
const sessionId = process.argv[2];
if (!sessionId) {
	console.error('Error: Please provide a session ID.');
	console.log('Usage: pnpm patch:emotion <sessionId>');
	process.exit(1);
}

// patchResponseJsonEmotion(sessionId).catch((error) => {
// 	console.error('Patch script failed:', error);
// 	process.exit(1);
// });
patchEntryAsterisk(sessionId).catch((error) => {
	console.error('Patch script failed:', error);
	process.exit(1);
});
