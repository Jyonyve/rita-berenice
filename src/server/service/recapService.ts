import { Collection, IncludeEnum } from 'chromadb';
import { chromaDbClient } from '../db/index.ts';
import {
	buildChatTurnToJsonString,
	ChatTurn,
	DEFAULT_RECAP_MODEL_FREE,
	METADATA_TYPES,
} from '#shared/index.ts';
import {
	buildLlmFactualRecapPrompt,
	buildLlmRelationshipRecapPrompt,
} from '../util/templateUtils.ts';
import { llmService } from './index.ts';
import {
	buildChatTurnDocument,
	buildRecapId,
	buildRelationshipRecapId,
	handleServiceError,
} from '../util/index.ts';

const { getRecapCollection, upsertRecord, getRecordById } = chromaDbClient;

export const recapService = {
	// Cache for lore collection
	_recapCollection: null as Collection | null,

	_getCollection: async (): Promise<Collection> => {
		if (recapService._recapCollection) {
			return recapService._recapCollection;
		}
		const collection = await getRecapCollection();
		recapService._recapCollection = collection;
		return collection;
	},

	/**
	 * Stores a factual recap based on the provided turns.
	 * Assumes turns are client-selected and appropriate for recap.
	 */
	storeFactualRecap: async (sessionId: string, recapTurns: ChatTurn[]): Promise<void> => {
		if (!recapTurns || recapTurns.length === 0) {
			console.warn(`[FactualRecap] Received empty turns for session ${sessionId}. Skipping.`);
			return;
		}

		// Get sequence and character name from the last turn provided
		const lastTurn = recapTurns[recapTurns.length - 1];
		if (!lastTurn || !lastTurn.response) {
			// Ensure lastTurn and its response exist
			console.warn(
				`[FactualRecap] Last turn or its response is invalid for session ${sessionId}. Skipping.`
			);
			return;
		}
		const { sequence, response } = lastTurn;
		const charName = response.showName;

		console.log(
			`[FactualRecap] Attempting for session ${sessionId}, up to sequence ${sequence} with ${recapTurns.length} turns.`
		);

		try {
			// 1. Format prompt (was step 2)
			const recapPromptContent = buildLlmFactualRecapPrompt(
				charName,
				recapTurns.map((turn) => buildChatTurnToJsonString(turn)).join('\n\n')
			);

			// 2. Get Recap Model Info (was step 3)
			const recapModelInfo = DEFAULT_RECAP_MODEL_FREE;

			// 3. Invoke LLM (was step 4)
			const recapContent = await llmService.invokeLlm('system', recapPromptContent, recapModelInfo);

			if (!recapContent || recapContent.trim() === '' || recapContent.startsWith('[Error')) {
				console.warn(
					`[FactualRecap] LLM generation for session ${sessionId}, sequence ${sequence} returned empty or error: "${recapContent}"`
				);
				return; // Don't store an empty or error recap
			}

			// 4. Save the Recap (was step 5)
			const recapId = buildRecapId(sessionId); // Typically one factual recap per session, updated
			const collection = await recapService._getCollection();
			await upsertRecord(collection, recapId, recapContent, {
				sessionId,
				sequence, // Sequence number of the last turn included in this recap
				timestamp: new Date().toISOString(),
				type: METADATA_TYPES.RECAP, // Assuming METADATA_TYPES.RECAP is for factual
			});
			console.log(
				`[FactualRecap] Successfully stored for session ${sessionId}, up to sequence ${sequence}.`
			);
		} catch (error) {
			// Use your centralized error handler
			handleServiceError(
				error,
				`[FactualRecap] Internal error for session ${sessionId}, sequence ${sequence}.`, // Context for server logs
				`Failed to store factual recap for session ${sessionId}` // More generic for client if rethrown
			);
			// Depending on handleServiceError, you might rethrow or it might handle the response
		}
	},

	/**
	 * Stores a relationship recap based on the provided turns.
	 * Assumes turns are client-selected and appropriate for recap.
	 */
	storeRelationshipRecap: async (sessionId: string, turnsForRecap: ChatTurn[]): Promise<void> => {
		if (!turnsForRecap || turnsForRecap.length < 1) {
			// Need at least one turn for speaker names
			console.warn(
				`[RelationshipRecap] Received insufficient turns for session ${sessionId}. Skipping.`
			);
			return;
		}

		const lastTurn = turnsForRecap[turnsForRecap.length - 1];
		if (!lastTurn || !lastTurn.request || !lastTurn.response) {
			console.warn(
				`[RelationshipRecap] Last turn or its request/response is invalid for session ${sessionId}. Skipping.`
			);
			return;
		}
		const { sequence } = lastTurn;
		const requestorName = turnsForRecap[0].request.showName; // Assuming first turn has representative names
		const responderName = turnsForRecap[0].response.showName;

		console.log(
			`[RelationshipRecap] Attempting for session ${sessionId}, up to sequence ${sequence} with ${turnsForRecap.length} turns.`
		);

		try {
			// 1. Format prompt
			// Using buildChatTurnDocument to get natural language representation for relationship recap
			const naturalLanguageTurns = turnsForRecap
				.map((turn) => buildChatTurnDocument(turn))
				.join('\n\n');
			const recapPromptContent = buildLlmRelationshipRecapPrompt(
				requestorName,
				responderName,
				naturalLanguageTurns
			);

			// 2. Get Recap Model Info
			const recapModelInfo = DEFAULT_RECAP_MODEL_FREE;

			// 3. Invoke LLM
			const recapContent = await llmService.invokeLlm('system', recapPromptContent, recapModelInfo);

			if (!recapContent || recapContent.trim() === '' || recapContent.startsWith('[Error')) {
				console.warn(
					`[RelationshipRecap] LLM generation for session ${sessionId}, sequence ${sequence} returned empty or error: "${recapContent}"`
				);
				return;
			}

			// 4. Save the Recap
			const relationshipRecapId = buildRelationshipRecapId(sessionId); // One relationship recap, updated
			const collection = await recapService._getCollection();
			await upsertRecord(collection, relationshipRecapId, recapContent, {
				sessionId,
				sequence, // Sequence number of the last turn included
				timestamp: new Date().toISOString(),
				type: METADATA_TYPES.RELATIONSHIP, // Use a distinct type
			});
			console.log(
				`[RelationshipRecap] Successfully stored for session ${sessionId}, up to sequence ${sequence}.`
			);
		} catch (error) {
			handleServiceError(
				error,
				`[RelationshipRecap] Internal error for session ${sessionId}, sequence ${sequence}.`,
				`Failed to store relationship recap for session ${sessionId}`
			);
		}
	},

	getRecap: async (sessionId: string): Promise<string> => {
		const collection = await recapService._getCollection();
		const recapId = buildRecapId(sessionId);
		try {
			const recap = (await getRecordById(collection, recapId)).documents?.[0];
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
			const recap = (await getRecordById(collection, relationshipRecapId)).documents?.[0];
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
