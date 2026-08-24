import { and, eq } from 'drizzle-orm';
import { Term, TermResponse } from '@rita-berenice/shared/api';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import {
	AiModelInfo,
	CharacterTermCdo,
	CharacterTermInfo,
	SessionTermCdo,
	SessionTermInfo,
	TermType,
} from '@rita-berenice/shared/domain';
import {
	buildCharacterTermId,
	buildSessionTermId,
	isCharacterTermInfo,
	isSessionTermInfo,
	parseSessionId,
} from '@rita-berenice/shared/util';
import { getDatabase } from '../db/postgresClient.js';
import { terms } from '../db/schema.js';
import { llmService } from '../service/llmService.js';

const toResponse = (items: (CharacterTermInfo | SessionTermInfo)[]): TermResponse => {
	const promptTerms: Term[] = items.map((item) => ({
		termId: item.termId,
		type: item.type,
		koreanTerm: item.koreanTerm,
		englishTerm: item.englishTerm,
	}));
	return {
		terms: promptTerms,
		term: promptTerms[0],
		characterTermInfos: items.filter(
			(item): item is CharacterTermInfo => item.type === METADATA_TYPES.CHARACTER
		),
		sessionTermInfos: items.filter(
			(item): item is SessionTermInfo => item.type === METADATA_TYPES.SESSION
		),
	};
};

export const mergeTermScopes = (
	characterTerms: CharacterTermInfo[],
	sessionTerms: SessionTermInfo[]
): (CharacterTermInfo | SessionTermInfo)[] => {
	const merged = new Map<string, CharacterTermInfo | SessionTermInfo>();
	characterTerms.forEach((term) => merged.set(term.koreanTerm, term));
	sessionTerms.forEach((term) => merged.set(term.koreanTerm, term));
	return [...merged.values()];
};

const upsert = async (item: CharacterTermInfo | SessionTermInfo): Promise<void> => {
	const now = new Date().toISOString();
	await getDatabase()
		.insert(terms)
		.values({
			termId: item.termId,
			termType: item.type,
			scopeId:
				item.type === METADATA_TYPES.SESSION ? (item as SessionTermInfo).sessionId : item.characterId,
			characterId: item.characterId,
			sessionId: item.type === METADATA_TYPES.SESSION ? (item as SessionTermInfo).sessionId : null,
			koreanTerm: item.koreanTerm,
			englishTerm: item.englishTerm,
			data: item,
			createdAt: item.createdAt || now,
			updatedAt: item.updatedAt || now,
		})
		.onConflictDoUpdate({
			target: terms.termId,
			set: {
				koreanTerm: item.koreanTerm,
				englishTerm: item.englishTerm,
				data: item,
				updatedAt: item.updatedAt || now,
			},
		});
};

export const termStore = {
	_characterTermCache: new Map<string, Map<string, CharacterTermInfo>>(),
	_sessionTermCache: new Map<string, Map<string, SessionTermInfo>>(),

	_getOrBuildCharacterTermMap: async (characterId: string) => {
		let cache = termStore._characterTermCache.get(characterId);
		if (!cache) {
			const response = await termStore.getTermsByCharacterId(characterId);
			cache = new Map(response.characterTermInfos.map((item) => [item.koreanTerm, item]));
			termStore._characterTermCache.set(characterId, cache);
		}
		return cache;
	},

	_getOrBuildSessionTermMap: async (sessionId: string) => {
		let cache = termStore._sessionTermCache.get(sessionId);
		if (!cache) {
			const response = await termStore.getTermsBySessionId(sessionId);
			cache = new Map(response.sessionTermInfos.map((item) => [item.koreanTerm, item]));
			termStore._sessionTermCache.set(sessionId, cache);
		}
		return cache;
	},

	storeCharacterTerm: async (
		input: CharacterTermCdo | CharacterTermInfo
	): Promise<{ termId: string }> => {
		const now = new Date().toISOString();
		const existing = isCharacterTermInfo(input);
		const item: CharacterTermInfo = {
			...input,
			termId: existing ? input.termId : buildCharacterTermId(input.characterId),
			type: METADATA_TYPES.CHARACTER,
			englishTerm: existing ? input.englishTerm : input.initialTerm,
			createdAt: existing ? input.createdAt : now,
			updatedAt: now,
		};
		await upsert(item);
		(await termStore._getOrBuildCharacterTermMap(item.characterId)).set(item.koreanTerm, item);
		return { termId: item.termId };
	},

	storeCharacterTerms: async (
		items: (CharacterTermCdo | CharacterTermInfo)[]
	): Promise<{ termIds: string[] }> => {
		const results = [];
		for (const item of items) results.push(await termStore.storeCharacterTerm(item));
		return { termIds: results.map((result) => result.termId) };
	},

	storeSessionTerm: async (input: SessionTermCdo | SessionTermInfo): Promise<{ termId: string }> => {
		const now = new Date().toISOString();
		const existing = isSessionTermInfo(input);
		const { characterId } = parseSessionId(input.sessionId);
		const item: SessionTermInfo = {
			...input,
			characterId,
			termId: existing ? input.termId : buildSessionTermId(input.sessionId),
			type: METADATA_TYPES.SESSION,
			englishTerm: existing ? input.englishTerm : input.initialTerm,
			createdAt: existing ? input.createdAt : now,
			updatedAt: now,
		};
		await upsert(item);
		(await termStore._getOrBuildSessionTermMap(item.sessionId)).set(item.koreanTerm, item);
		return { termId: item.termId };
	},

	storeSessionTerms: async (
		items: (SessionTermCdo | SessionTermInfo)[]
	): Promise<{ termIds: string[] }> => {
		const results = [];
		for (const item of items) results.push(await termStore.storeSessionTerm(item));
		return { termIds: results.map((result) => result.termId) };
	},

	getTermByKorean: async (id: string, koreanTerm: string, type: TermType): Promise<TermResponse> => {
		const scope = type === 'character' ? eq(terms.characterId, id) : eq(terms.sessionId, id);
		const rows = await getDatabase()
			.select({ data: terms.data })
			.from(terms)
			.where(and(eq(terms.termType, type), eq(terms.koreanTerm, koreanTerm), scope))
			.limit(1);
		return toResponse(rows.map((row) => row.data));
	},

	getTermsByCharacterId: async (characterId: string): Promise<TermResponse> => {
		const rows = await getDatabase()
			.select({ data: terms.data })
			.from(terms)
			.where(and(eq(terms.termType, METADATA_TYPES.CHARACTER), eq(terms.characterId, characterId)));
		return toResponse(rows.map((row) => row.data));
	},

	getTermsBySessionId: async (sessionId: string): Promise<TermResponse> => {
		const rows = await getDatabase()
			.select({ data: terms.data })
			.from(terms)
			.where(and(eq(terms.termType, METADATA_TYPES.SESSION), eq(terms.sessionId, sessionId)));
		return toResponse(rows.map((row) => row.data));
	},

	getTermsForSession: async (sessionId: string): Promise<TermResponse> => {
		const { characterId } = parseSessionId(sessionId);
		const [characterTerms, sessionTerms] = await Promise.all([
			termStore._getOrBuildCharacterTermMap(characterId),
			termStore._getOrBuildSessionTermMap(sessionId),
		]);
		return toResponse(mergeTermScopes([...characterTerms.values()], [...sessionTerms.values()]));
	},

	ensureAndGetTermsForPrompt: async (
		sessionId: string,
		userId: string,
		koreanTermsToEnsure: string[],
		utilityModelInfo?: AiModelInfo
	): Promise<Map<string, string>> => {
		const { characterId } = parseSessionId(sessionId);
		const [characterTerms, sessionTerms] = await Promise.all([
			termStore._getOrBuildCharacterTermMap(characterId),
			termStore._getOrBuildSessionTermMap(sessionId),
		]);
		const result = new Map<string, string>();
		for (const koreanTerm of new Set(koreanTermsToEnsure.filter(Boolean))) {
			const existing = sessionTerms.get(koreanTerm) ?? characterTerms.get(koreanTerm);
			if (existing) {
				result.set(koreanTerm, existing.englishTerm);
				continue;
			}
			const initialTerm = await llmService.translateProperNoun(koreanTerm, userId, utilityModelInfo);
			if (!initialTerm?.trim()) continue;
			await termStore.storeSessionTerm({ sessionId, koreanTerm, initialTerm });
			result.set(koreanTerm, initialTerm);
		}
		return result;
	},

	ensureAndGetCharacterTerms: async (
		characterId: string,
		userId: string,
		koreanTermsToEnsure: string[],
		utilityModelInfo?: AiModelInfo
	): Promise<Map<string, string>> => {
		const characterTerms = await termStore._getOrBuildCharacterTermMap(characterId);
		const result = new Map<string, string>();
		for (const koreanTerm of new Set(
			koreanTermsToEnsure.map((term) => term.trim()).filter(Boolean)
		)) {
			const existing = characterTerms.get(koreanTerm);
			if (existing) {
				result.set(koreanTerm, existing.englishTerm);
				continue;
			}
			const initialTerm = await llmService.translateProperNoun(koreanTerm, userId, utilityModelInfo);
			if (!initialTerm?.trim()) continue;
			await termStore.storeCharacterTerm({ characterId, koreanTerm, initialTerm });
			result.set(koreanTerm, initialTerm);
		}
		return result;
	},

	storeMissingCharacterTermMappings: async (
		characterId: string,
		mappings: Array<{ koreanTerm: string; englishTerm: string }>
	): Promise<Map<string, string>> => {
		const characterTerms = await termStore._getOrBuildCharacterTermMap(characterId);
		const result = new Map<string, string>();
		for (const mapping of mappings) {
			const koreanTerm = mapping.koreanTerm.trim();
			const englishTerm = mapping.englishTerm.trim();
			if (!koreanTerm || !englishTerm || result.has(koreanTerm)) continue;
			const existing = characterTerms.get(koreanTerm);
			if (existing) {
				result.set(koreanTerm, existing.englishTerm);
				continue;
			}
			await termStore.storeCharacterTerm({ characterId, koreanTerm, initialTerm: englishTerm });
			result.set(koreanTerm, englishTerm);
		}
		return result;
	},

	clearCharacterCache: (characterId: string): void => {
		termStore._characterTermCache.delete(characterId);
	},
	clearSessionCache: (sessionId: string): void => {
		termStore._sessionTermCache.delete(sessionId);
	},
	clearAllCaches: (): void => {
		termStore._characterTermCache.clear();
		termStore._sessionTermCache.clear();
	},
	clearCollectionCache: (): void => {},
};
