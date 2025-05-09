import {
	ChatTurn,
	DEFAULT_RECAP_MODEL_FREE,
	METADATA_TYPES,
} from '#root/src/shared/domain/index.ts';
import { Collection, IncludeEnum } from 'chromadb';
import { chromaDbClient } from '../db/index.ts';
import {
	buildChatTurnToJsonString,
	buildRecapId,
	buildRelationshipRecapId,
} from '#root/src/shared/index.ts';
import { buildLlmRecapPrompt, buildLlmRelationshipRecapPrompt } from '../util/templateUtils.ts';
import { llmService } from './index.ts';
import { buildChatMessageDocument, buildChatTurnDocument } from '../util/index.ts';

const { getRecapCollection, upsertRecord } = chromaDbClient;

export const recapService = {
	// Cache for lore collection
	_recapCollection: null as Collection | null,

	// Get collection with caching
	_getCollection: async (): Promise<Collection> => {
		if (recapService._recapCollection) return recapService._recapCollection;
		const collection = await getRecapCollection();
		recapService._recapCollection = collection;
		return collection;
	},

	storeRecap: async (sessionId: string, turnsForRecap: ChatTurn[]): Promise<void> => {
		// validation
		const sequence = turnsForRecap[turnsForRecap.length - 1].sequence;
		// 2. Format prompt
		const recapPromptContent = buildLlmRecapPrompt(
			turnsForRecap.map((turn) => buildChatTurnToJsonString(turn)).join('\n\n')
		);

		// 3. Get Recap Model Info (use default or allow configuration later)
		const recapModelInfo = DEFAULT_RECAP_MODEL_FREE; // Use keyless default shared constant

		// 4. Invoke LLM via llmService
		const recapContent = await llmService.invokeLlm('system', recapPromptContent, recapModelInfo); // Use invokeLlm

		if (!recapContent || recapContent.startsWith('[Error')) {
			console.warn(`Recap generation for sequence ${sequence} returned empty/error.`);
			return;
		}

		// 5. Save the Recap
		const recapId = buildRecapId(sessionId);
		const collection = await recapService._getCollection();
		await upsertRecord(collection, recapId, recapContent, {
			type: METADATA_TYPES.RECAP,
			sequence,
			timestamp: new Date().toISOString(),
			sessionId,
		});
		console.log(
			`Successfully generated and saved recap for sequence No ${sequence}, session ${sessionId}.`
		);
	},

	storeRelationshipRecap: async (sessionId: string, turnsForRecap: ChatTurn[]): Promise<void> => {
		//
		const sequence = turnsForRecap[turnsForRecap.length - 1].sequence;
		const simpleChatLogs = turnsForRecap.map((turn) => buildChatTurnDocument(turn));

		// 2. Format prompt
		const recapPromptContent = buildLlmRelationshipRecapPrompt(
			simpleChatLogs[0].userName,
			simpleChatLogs[0].charName,
			simpleChatLogs.map((log) => JSON.stringify(log)).join('\n\n')
		);

		// 3. Get Recap Model Info (use default or allow configuration later)
		const recapModelInfo = DEFAULT_RECAP_MODEL_FREE; // Use keyless default shared constant

		// 4. Invoke LLM via llmService
		const recapContent = await llmService.invokeLlm('system', recapPromptContent, recapModelInfo); // Use invokeLlm

		if (!recapContent || recapContent.startsWith('[Error')) {
			console.warn(`Recap generation for sequence ${sequence} returned empty/error.`);
			return;
		}

		// 5. Save the Recap
		const relationshipRecapId = buildRelationshipRecapId(sessionId);
		const collection = await recapService._getCollection();
		await upsertRecord(collection, relationshipRecapId, recapContent, {
			type: METADATA_TYPES.RECAP,
			sequence,
			timestamp: new Date().toISOString(),
			sessionId,
		});

		console.log(
			`Successfully generated and saved relationship recap for sequence No ${sequence}, session ${sessionId}.`
		);
	},
	getRecap: async (sessionId: string): Promise<string> => {
		const collection = await recapService._getCollection();
		const recapId = buildRecapId(sessionId);
		try {
			const recap = await getDocumentById(collection, recapId);
			return recap || '';
		} catch (error) {
			console.warn(`No recap found for session ${sessionId}`);
			return '';
		}
	},

	getRelationshipRecap: async (sessionId: string): Promise<string> => {
		const collection = await recapService._getCollection();
		const relationshipRecapId = buildRelationshipRecapId(sessionId);
		try {
			const recap = await getDocumentById(collection, relationshipRecapId);
			return recap || '';
		} catch (error) {
			// It's common for a recap not to exist initially, so log as warn or info
			console.info(
				`No relationship recap found for ID ${relationshipRecapId} (session ${sessionId}). This may be normal.`
			);
			return '';
		}
	},
	// Method to clear the cache
	clearCollectionCache: (): void => {
		recapService._recapCollection = null;
	},
};
