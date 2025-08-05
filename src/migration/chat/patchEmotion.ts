import { ChromaClient, Collection, Metadata } from 'chromadb';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { ChatMessage } from '#shared/domain/chat/index.js';
import { EmotionValue } from '#shared/index.js';
import { chromaDbClient } from '#server/index.js';

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

// Get the session ID from command-line arguments
const sessionId = process.argv[2];
if (!sessionId) {
	console.error('Error: Please provide a session ID.');
	console.log('Usage: pnpm patch:emotion <sessionId>');
	process.exit(1);
}

patchResponseJsonEmotion(sessionId).catch((error) => {
	console.error('Patch script failed:', error);
	process.exit(1);
});
