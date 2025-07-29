// Save this file as scripts/initSession.ts

import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import { chromaDbClient, sessionStore, termStore } from '#server/index.js';
import { SessionInfo, SessionMetadata, TermCdo } from '#shared/domain/index.js';
import { buildProfileId, buildTermId, METADATA_TYPES } from '#shared/index.js';

export const getOriginalTerms = (sessionId: string): TermCdo[] => [
	{ koreanTerm: '타리온', initialTerm: 'Tarion', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '라이델', initialTerm: 'Rydell', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '요니브', initialTerm: 'Yonyve', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '엘리시오스', initialTerm: 'Elysios', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '바르가스', initialTerm: 'Vargas', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '엘리시아', initialTerm: 'Elysia', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '알데바란', initialTerm: 'Aldebaraan', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '알리스터', initialTerm: 'Alastair', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '앨리', initialTerm: 'Ally', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '아리온', initialTerm: 'Aarion', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '카사르', initialTerm: 'Kassar', sessionId, termId: buildTermId(sessionId) },
];
export const getSpinoffTerms = (sessionId: string): TermCdo[] => [
	{ koreanTerm: '타리온', initialTerm: 'Tarion', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '라이델', initialTerm: 'Rydell', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '요니브', initialTerm: 'Yonyve', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '엘리시오스', initialTerm: 'Elysios', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '바르가스', initialTerm: 'Vargas', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '엘리시아', initialTerm: 'Elysia', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '알데바란', initialTerm: 'Aldebaraan', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '알리스터', initialTerm: 'Alastair', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '앨리', initialTerm: 'Ally', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '아리온', initialTerm: 'Aarion', sessionId, termId: buildTermId(sessionId) },
	{ koreanTerm: '카사르', initialTerm: 'Kassar', sessionId, termId: buildTermId(sessionId) },
];

// --- Main Seeding Logic ---
async function initTerm() {
	try {
		// Step 1: GET the collection directly.
		console.log(`Getting collection "${COLLECTIONS.TERM}"...`);

		await termStore.storeTerms(getOriginalTerms(sessionId));
		await termStore.storeTerms(getSpinoffTerms(sessionId));

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
initTerm();
