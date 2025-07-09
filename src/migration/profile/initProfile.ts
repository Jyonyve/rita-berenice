// Save this file as scripts/initProfile.ts

import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import { profileStore } from '#server/index.js';

import { ProfileCdo } from '#shared/domain/profile/ProfileInterfaces.js';

const userId = '6b335673-c837-43f9-a1c7-0b92c90edefb';
/**
 * Generates a sample user profile for migration.
 * @param {string} userId - The ID of the user.
 * @param {string} sessionId - The unique session ID for this profile instance.
 * @returns {ProfileCdo} A profile creation data object.
 */
export const getUserProfileTemplate = (userId: string, sessionId: string): ProfileCdo => ({
	name: 'yonyve',
	gender: 'female',
	title: "The Marquis' Eldest Daughter",
	showName: '요니브',
	description: `A user profile for session ${sessionId}.`,
	userId: userId,
	sessionId: sessionId,
});

// --- Main Seeding Logic ---
async function initProfile() {
	// const sessionId = 'tarion_original_fhTob3vkzxHF6tJc';
	const sessionId = 'tarion_spinoff_Oin8t5Lxbc8glaU7';
	try {
		// Step 1: GET the collection. Do NOT create it.
		console.log(`Getting collection "${COLLECTIONS.PROFILE}"...`);

		// Step 2: It is now safe to upsert profile data. The server will do the embedding.
		console.log(`Upserting profiles...`);

		// Upsert sample profiles with a specific userId and unique sessionIds
		console.log(await profileStore.storeProfile(getUserProfileTemplate(userId, sessionId)));

		console.log(`✅ Successfully seeded profiles.`);
		process.exit(0);
	} catch (error: any) {
		// Step 3: If getting the collection fails, exit with a helpful error.
		console.error('❌ Error seeding initial profile data:', error.message);
		console.error(
			'This likely means the collection does not exist. Please run the admin creation script via SSH first.'
		);
		process.exit(1);
	}
}

// --- Run the script ---
initProfile();
