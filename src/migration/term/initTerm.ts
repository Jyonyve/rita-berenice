// Save this file as scripts/initSession.ts

import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import { chromaDbClient, sessionStore, termStore } from '#server/index.js';
import { CharacterTermCdo, SessionTermCdo } from '#shared/domain/index.js';
import { parseSessionId } from '#shared/index.js';
export const getCharacterTerms = (characterId: string): CharacterTermCdo[] => [
	{ koreanTerm: '타리온', initialTerm: 'Tarion', characterId },
	{ koreanTerm: '라이델', initialTerm: 'Rydell', characterId },
	{ koreanTerm: '바르가스', initialTerm: 'Vargas', characterId },
	{ koreanTerm: '엘리시아', initialTerm: 'Elysia', characterId },
	{ koreanTerm: '알데바란', initialTerm: 'Aldebaraan', characterId },
	{ koreanTerm: '아리온', initialTerm: 'Aarion', characterId },
	{ koreanTerm: '카사르', initialTerm: 'Kassar', characterId },
];
export const getSessionTerms = (sessionId: string): SessionTermCdo[] => [
	{ koreanTerm: '타리온', initialTerm: 'Tarion', sessionId },
	{ koreanTerm: '라이델', initialTerm: 'Rydell', sessionId },
	{ koreanTerm: '요니브', initialTerm: 'Yonyve', sessionId },
	{ koreanTerm: '엘리시오스', initialTerm: 'Elysios', sessionId },
	{ koreanTerm: '바르가스', initialTerm: 'Vargas', sessionId },
	{ koreanTerm: '엘리시아', initialTerm: 'Elysia', sessionId },
	{ koreanTerm: '알데바란', initialTerm: 'Aldebaraan', sessionId },
	{ koreanTerm: '알리스터', initialTerm: 'Alastair', sessionId },
	{ koreanTerm: '앨리', initialTerm: 'Ally', sessionId },
	{ koreanTerm: '아리온', initialTerm: 'Aarion', sessionId },
	{ koreanTerm: '카사르', initialTerm: 'Kassar', sessionId },
];

// --- Main Seeding Logic ---
async function initTerm() {
	try {
		// Step 1: GET the collection directly.
		console.log(`Getting collection "${COLLECTIONS.TERM}"...`);
		const { characterId } = parseSessionId(sessionId);
		await termStore.storeCharacterTerms(getCharacterTerms(characterId));
		await termStore.storeSessionTerms(getSessionTerms(sessionId));

		console.log(`✅ Successfully seeded initial term.`);
		process.exit(0);
	} catch (error: any) {
		// Step 6: If anything fails, exit with a helpful error.
		console.error('❌ Error seeding initial term data:', error.message);
		process.exit(1);
	}
}
const sessionId = process.argv[2];

// --- Run the script ---
// initTerm();
