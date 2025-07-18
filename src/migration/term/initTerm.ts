// Save this file as scripts/initSession.ts

import { COLLECTIONS } from '#server/db/ChromaInterfaces.js';
import { chromaDbClient, flatSessionToDoc, sessionStore, termStore } from '#server/index.js';
import { SessionInfo, SessionMetadata, TermCdo } from '#shared/domain/index.js';
import { buildProfileId, buildTermId, METADATA_TYPES } from '#shared/index.js';

const tarion_original = 'tarion_original_ueDVsINn';
const tarion_spinoff = 'tarion_spinoff_sw1MLtIj';
const userId = '6b335673-c837-43f9-a1c7-0b92c90edefb';

const originalTerms: TermCdo[] = [
	{
		koreanTerm: '바르가스',
		initialTerm: 'Vargas',
		sessionId: tarion_original,
		termId: buildTermId(tarion_original),
	},
	{
		koreanTerm: '엘리시아',
		initialTerm: 'Elysia',
		sessionId: tarion_original,
		termId: buildTermId(tarion_original),
	},
	{
		koreanTerm: '알데바란',
		initialTerm: 'Aldebaraan',
		sessionId: tarion_original,
		termId: buildTermId(tarion_original),
	},
	{
		koreanTerm: '알리스터',
		initialTerm: 'Alastair',
		sessionId: tarion_original,
		termId: buildTermId(tarion_original),
	},
	{
		koreanTerm: '아리온',
		initialTerm: 'Aarion',
		sessionId: tarion_original,
		termId: buildTermId(tarion_original),
	},
	{
		koreanTerm: '카사르',
		initialTerm: 'Kassar',
		sessionId: tarion_original,
		termId: buildTermId(tarion_original),
	},
];
const spinoffTerms: TermCdo[] = [
	{
		koreanTerm: '바르가스',
		initialTerm: 'Vargas',
		sessionId: tarion_spinoff,
		termId: buildTermId(tarion_spinoff),
	},
	{
		koreanTerm: '엘리시아',
		initialTerm: 'Elysia',
		sessionId: tarion_spinoff,
		termId: buildTermId(tarion_spinoff),
	},
	{
		koreanTerm: '알데바란',
		initialTerm: 'Aldebaraan',
		sessionId: tarion_spinoff,
		termId: buildTermId(tarion_spinoff),
	},
	{
		koreanTerm: '알리스터',
		initialTerm: 'Alastair',
		sessionId: tarion_spinoff,
		termId: buildTermId(tarion_spinoff),
	},
	{
		koreanTerm: '아리온',
		initialTerm: 'Aarion',
		sessionId: tarion_spinoff,
		termId: buildTermId(tarion_spinoff),
	},
	{
		koreanTerm: '카사르',
		initialTerm: 'Kassar',
		sessionId: tarion_spinoff,
		termId: buildTermId(tarion_spinoff),
	},
];

// --- Main Seeding Logic ---
async function initTerm() {
	try {
		// Step 1: GET the collection directly.
		console.log(`Getting collection "${COLLECTIONS.TERM}"...`);

		await termStore.storeTerms(originalTerms);
		await termStore.storeTerms(spinoffTerms);

		console.log(`✅ Successfully seeded initial term.`);
		process.exit(0);
	} catch (error: any) {
		// Step 6: If anything fails, exit with a helpful error.
		console.error('❌ Error seeding initial term data:', error.message);
		process.exit(1);
	}
}

// --- Run the script ---
initTerm();
