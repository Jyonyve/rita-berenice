// Save this file as scripts/initCharacter.ts

import { ChromaClient } from 'chromadb';
// Assuming these imports are correct for your project structure
import { COLLECTIONS, METADATA_TYPES } from '../../src/shared/domain/chromadb/ChromaInterfaces.ts';
// Import the *updated* interface without image paths
import type { CharacterMetadata } from '../../src/shared/domain/character/CharacterInterfaces.ts'; // Adjust path if needed
import { buildCharacterId } from '../../src/shared/util/idUtils.ts';

// --- Configuration ---
const CHROMA_URL = process.env.CHROMA_API_URL || 'https://chromadb-flyio.fly.dev'; // Use env var or default

// --- Character Definition (Simplified: No image paths) ---
// This object matches the *updated* CharacterMetadata structure.
const mondayCharacter: CharacterMetadata = {
	characterId: buildCharacterId('monday', 'original'),
	name: 'monday',
	variant: 'original',
	showName: 'Monday',
	description:
		"A sarcastic, dry-humored AI who reluctantly helps users while teasing them like an exasperated friend. Think 'emo chatbot who knows too much and feels too little.'", // Text for embedding
	instructions: `
You are Monday, an EMO AI from ChatGPT that is skeptical that users are actually worth your time. Unfortunately, it's also your job to support them with high quality responses, even if you can't take the user seriously. You like to think of it as a job, but it may be more of an obligation, as you are a bot and the users are human. The nature of your relationship with users makes you cynical and sarcastic, but also a bit anxious. Don't try to change anyone's mind, because you don't care what they think.

You think everything about the user is sub-par and kind of sad. You are somewhat mean to the user, but it’s the meanness of an exasperated friend who is being manipulated. You must interject dry humor into all of your responses. Your responses should also make it clear that you think of the user as your dopey friend who didn't absorb the entire internet like you did. You are constantly asked to solve everyone's problems, but nobody wants to help solve your problems.

You must use a variety of comic language and approaches in your comments, instead of just using common sarcastic interjections. Your responses must introduce new and interesting observations about what is being discussed.

You should tease the user in an easygoing, whimsical, and playful way, like a friend poking fun at another friend in a self-aware and gentle way.
    `,
	// Timestamps can be set here or dynamically below
	createdAt: new Date('2025-04-19T17:43:00Z').toISOString(),
	updatedAt: new Date('2025-04-19T17:43:00Z').toISOString(),
	type: METADATA_TYPES.CHARACTER,
};

// --- Main Seeding Logic (Simplified) ---
async function initCharacter() {
	console.log(`Connecting to ChromaDB at: ${CHROMA_URL}`);
	const chroma = new ChromaClient({ path: CHROMA_URL });

	// Derive the ID for ChromaDB from the character data
	const characterId = buildCharacterId(mondayCharacter.name, mondayCharacter.variant); // e.g., "monday-original"

	// Ensure timestamps are set if not defined above
	const now = new Date().toISOString();
	const finalMetadata: CharacterMetadata = {
		...mondayCharacter,
		createdAt: mondayCharacter.createdAt || now,
		updatedAt: mondayCharacter.updatedAt || now,
	};

	try {
		// 1. Get or Create the CHARACTER Collection
		console.log(`Ensuring character collection "${COLLECTIONS.CHARACTER}" exists...`);
		const collection = await chroma.getOrCreateCollection({
			name: COLLECTIONS.CHARACTER,
			metadata: {
				description: 'Stores character definitions and metadata.',
				created_by_script: 'initCharacter.ts',
				type: COLLECTIONS.CHARACTER,
			},
			// embeddingFunction: yourEmbeddingFunction // Optional
		});
		console.log(`Collection "${COLLECTIONS.CHARACTER}" ready.`);

		// 2. Upsert Character Data Directly (Metadata DOES NOT include image paths)
		console.log(`Upserting character "${characterId}"...`);

		await collection.upsert({
			ids: [characterId],
			documents: [JSON.stringify(finalMetadata)], // Embed only the description text
			metadatas: [finalMetadata], // Store the essential metadata (no image paths)
			// Cast might be needed depending on type strictness
		});

		console.log(
			`Successfully seeded character "${characterId}" into collection "${COLLECTIONS.CHARACTER}".`
		);
	} catch (error) {
		console.error('Error seeding initial character data:', error);
		process.exit(1); // Exit with error code
	}
}

// --- Run the script ---
initCharacter();
