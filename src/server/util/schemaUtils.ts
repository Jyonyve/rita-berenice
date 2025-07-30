import { z } from 'zod';
import { curatedEmotionKeywords } from '#shared/config/emotionWordsMapper.js';

type NonEmptyArray<T> = [T, ...T[]];
const emotionList = curatedEmotionKeywords as NonEmptyArray<string>;
/**
 * Creates a Zod schema for validating the persona response from the LLM.
 *
 * @param charName - The name of the character.
 * @param userName - The name of the user.
 * @param langCode - The language code ('kor' or 'eng') for locale-specific descriptions.
 * @param allEmotionKeywordsList - A non-empty array of valid emotion strings.
 * @returns A Zod object schema for validation.
 */
export const createPersonaResponseSchema = (
	charName: string,
	userName: string,
	langCode: 'kor' | 'eng' = 'kor'
) =>
	z.object({
		response: z
			.string()
			.describe(
				`The character's response, narrated in the third person. It MUST be around 1000 characters long, more than 800 characters (including spaces). ` +
					`Narrative actions or descriptions MUST be enclosed in asterisks (*). Spoken dialogue is plain text. ` +
					`A line break (\\n) MUST be inserted when switching between narration and dialogue. ` +
					`In Korean, these actions MUST end with '~다'. Refer to the user as '${userName}'. ` +
					`Example: '${
						langCode === 'kor'
							? `*${charName}이 바닥에 앉는다.*\n오늘 하루 길었네.\n*그는 ${userName}을(를) 본다.*`
							: `*${charName} sits on the floor.*\nA long day today.\n*He sees ${userName}.*`
					}'`
			),
		emotion: z
			.enum(emotionList)
			.describe(
				`A single English word representing the character's dominant emotion. It MUST be an exact match from the provided list.`
			),
	});

/**
 * Creates a Zod schema for validating ChatTurn metadata.
 * Dynamically adapts based on available lore and history contexts.
 * Compatible with LangChain's .withStructuredOutput() (no transforms).
 *
 * @param charEng - The English name of the character.
 * @param userEng - The English name of the user.
 * @param existingLoreIds - Array of valid lore IDs (empty if none available).
 * @param existingHistoryIds - Array of valid history IDs (empty if none available).
 */
export const createChatTurnMetadataSchema = (charEng: string, userEng: string) => {
	// Helper to create reference schema based on available IDs
	const createReferenceSchema = (ids: string[], itemType: string) => {
		if (ids.length > 0) {
			// State: IDs exist - enforce enum validation
			return z.array(
				z.object({ id: z.enum(ids as [string, ...string[]]), relevance: z.number().min(0.0).max(1.0) })
			);
		} else {
			// State: No IDs - enforce empty array
			return z
				.array(z.any())
				.max(0)
				.describe(`No ${itemType} items are available to reference, so this must be an empty array.`);
		}
	};

	return z.object({
		summary: z
			.string()
			.describe(
				`A concise summary of the turn in max 50 words. Example: 'User asks about ${charEng}'s past, and ${charEng} evades.'`
			),

		keywordList: z
			.array(z.string())
			.describe("An array of general keywords, e.g., ['conversation', 'past', 'evasion']"),

		topicList: z
			.array(z.string())
			.describe(
				"An array of broader themes in snake_case, e.g., ['character_background', 'trust_issues']"
			),

		entityList: z
			.array(z.string())
			.describe(
				`An array of entities mentioned, formatted as 'type:name'. Example: ['character:${charEng}', 'character:${userEng}', 'location:DarkForest']`
			),

		userEmotion: z.object({
			primary: z
				.string()
				.describe(
					`The primary emotion of ${userEng}. MUST be one of the following: [${emotionList.join(', ')}]`
				),
			intensity: z
				.number()
				.min(0.0)
				.max(1.0)
				.describe('The intensity of the primary emotion, from 0.0 to 1.0.'),
			nuanceList: z
				.array(z.string())
				.describe("An array of specific emotion words, e.g., ['frustration', 'curiosity']"),
		}),

		characterEmotion: z.object({
			primary: z
				.string()
				.describe(
					`The primary emotion of ${charEng}. MUST be one of the following: [${emotionList.join(', ')}]`
				),
			intensity: z
				.number()
				.min(0.0)
				.max(1.0)
				.describe('The intensity of the primary emotion, from 0.0 to 1.0.'),
			nuanceList: z
				.array(z.string())
				.describe("An array of specific emotion words, e.g., ['defensive', 'sadness']"),
		}),

		relationshipShiftList: z
			.array(z.string())
			.describe(
				`Describes a dynamic change between two entities. Example: ['${charEng}-${userEng}:trust_increased']`
			),

		dialogueAct: z
			.string()
			.describe("The conversational act, e.g., 'question', 'answer', 'revelation', 'evasion'"),

		actionList: z
			.array(z.string())
			.describe(
				`Observable actions taken by entities. Example: ['${charEng}_draws_sword', '${userEng}_offers_potion']`
			),
		loreReferenceList: z
			.array(z.object({ id: z.string(), relevance: z.number().min(0.0).max(1.0) }))
			.describe(
				`A list of lore items relevant to this turn. You MUST choose the 'id' from the 'loreId' in the <AvailableLore> catalog provided in the main prompt. Return empty array [] if none available.`
			),

		historyReferenceList: z
			.array(z.object({ id: z.string(), relevance: z.number().min(0.0).max(1.0) }))
			.describe(
				`A list of lore items relevant to this turn. You MUST choose the 'id' from the 'loreId' in the <AvailableLore> catalog provided in the main prompt. Return empty array [] if none available.`
			),

		flagList: z
			.array(z.string())
			.describe(
				"An array of flags for significant events, e.g., ['new_lore_revealed', 'major_plot_point']"
			),

		memoryChunk: z
			.string()
			.describe('A self-contained summary of this turn (max 100 words) for future RAG retrieval.'),
	});
};

/**
 * Creates a comprehensive Zod schema for validating all metadata of a LORE entry.
 * Aligns directly with the LoreInfo interface.
 */
export const createLoreMetadataSchema = (availableCharacterIds: string[]) => {
	return z.object({
		// Core Identification
		generatedEnglishTitle: z
			.string()
			.describe('A concise, descriptive title in English for the lore entry.'),
		summary: z.string().describe('A one-paragraph summary of the lore, explaining its significance.'),
		category: z
			.string()
			.describe("A category for the lore, e.g., 'Mythology', 'Item', 'Concept', 'Organization'."),
		source: z
			.string()
			.describe("Where this lore originates from, e.g., 'Ancient Texts', 'Character Dialogue'."),

		// Character Involvement
		sideCharacterIdList: z
			.array(z.string())
			.describe(
				`Other characters significantly related to this lore. MUST be chosen from: [${availableCharacterIds.join(', ')}]`
			),

		// Searchable Indexable Lists
		keywordList: z.array(z.string()).describe('An array of 3-5 specific keywords for search.'),
		topicList: z.array(z.string()).describe('An array of 1-3 broader themes or topics.'),
		entityList: z
			.array(z.string())
			.describe('An array of named entities mentioned (people, places, items).'),
	});
};

/**
 * Creates a comprehensive Zod schema for validating all metadata of a HISTORY entry.
 * Aligns directly with the HistoryInfo interface.
 */
export const createHistoryMetadataSchema = (
	availableCharacterIds: string[],
	existingHistoryEntries: { originalTitle: string; historyId: string }[]
) => {
	const existingEventTitles = existingHistoryEntries.map((h) => h.originalTitle);

	return z.object({
		// Core Identification
		generatedEnglishTitle: z
			.string()
			.describe('A concise, descriptive title in English for the event.'),
		summary: z
			.string()
			.describe('A one-paragraph summary of the event, capturing the key actions and outcomes.'),
		category: z
			.string()
			.describe(
				"A category for the event, e.g., 'Character Origin', 'Major Conflict', 'Political Event'."
			),

		// Character Involvement
		sideCharacterIdList: z
			.array(z.string())
			.describe(
				`Other characters involved in the event. MUST be chosen from: [${availableCharacterIds.join(', ')}]`
			),

		// Timeline Information
		period: z.object({
			label: z
				.string()
				.describe("A descriptive label for the life period, e.g., 'Childhood', 'Reign', 'Exile'."),
			confidence: z
				.number()
				.min(0.0)
				.max(1.0)
				.describe('Confidence in the period label from 0.0 to 1.0.'),
		}),
		eventDate: z.object({
			value: z.string().describe("The estimated date value, e.g., 'YYYY-MM-DD', 'Age 15'."),
			type: z
				.enum(['absolute_date', 'estimated_year', 'relative_to_event', 'era_defined'])
				.describe('The type of date being provided.'),
			confidence: z.number().min(0.0).max(1.0).describe('Confidence in the date estimation.'),
		}),
		// Correctly named to match the HistoryInfo interface
		relatedEventList: z
			.array(
				z.object({
					type: z.enum([
						'PRECEDES',
						'SUCCEEDS',
						'CONCURRENT_WITH',
						'OVERLAPS_WITH',
						'CAUSED_BY',
						'RESULTS_IN',
					]),
					relatedEventTitle: z
						.string()
						.describe(
							`The exact title of a related event. MUST be one of: [${existingEventTitles.join(', ')}]`
						),
					description: z.string().optional().describe('An optional brief description of the relation.'),
				})
			)
			.describe('An array of relationships to other events, or an empty array if none exist.'),

		// Searchable Indexable Lists
		keywordList: z.array(z.string()).describe('An array of 3-5 specific keywords for search.'),
		topicList: z.array(z.string()).describe('An array of 1-3 broader themes.'),
		entityList: z
			.array(z.string())
			.describe('An array of named entities mentioned (people, places, events).'),
	});
};

/**
 * Creates a Zod schema for validating the structured output of a Factual Recap.
 * The descriptions guide the LLM for more accurate metadata generation.
 *
 * @param availableKeywords - A list of valid keywords to guide LLM selection.
 * @param availableTopics - A list of valid topics to guide LLM selection.
 * @param availableEntities - A list of valid entities to guide LLM selection.
 * @param existingLoreIds - A list of valid lore IDs for reference linking.
 * @param existingHistoryIds - A list of valid history IDs for reference linking.
 */
export const createFactualRecapSchema = (
	availableKeywords: string[],
	availableTopics: string[],
	availableEntities: string[],
	existingLoreIds: string[],
	existingHistoryIds: string[]
) =>
	z.object({
		content: z.string().describe('The detailed factual ledger content, written in Korean.'),
		keywords: z
			.array(z.string())
			.describe(
				`An array of 5-10 of the most relevant factual keywords, selected from: [${availableKeywords.join(', ')}]`
			),
		topics: z
			.array(z.string())
			.describe(`An array of 3-7 key factual themes, selected from: [${availableTopics.join(', ')}]`),
		entities: z
			.array(z.string())
			.describe(`An array of important entities, selected from: [${availableEntities.join(', ')}]`),
		flags: z
			.array(z.string())
			.describe(
				"An array of fact-specific flags, e.g., ['new_lore_revealed', 'character_background_disclosed', 'plot_advancement']"
			),
		loreReferenceList: z
			.array(z.object({ id: z.string(), relevance: z.number().min(0.0).max(1.0) }))
			.describe(
				`A list of relevant lore IDs, selected ONLY from this list: [${existingLoreIds.join(', ')}]`
			),
		historyReferenceList: z
			.array(z.object({ id: z.string(), relevance: z.number().min(0.0).max(1.0) }))
			.describe(
				`A list of relevant history IDs, selected ONLY from this list: [${existingHistoryIds.join(', ')}]`
			),
	});

/**
 * Creates a Zod schema for validating the structured output of a Relationship Recap.
 * The descriptions guide the LLM for more accurate metadata generation.
 *
 * @param availableKeywords - A list of valid keywords to guide LLM selection.
 * @param availableTopics - A list of valid topics to guide LLM selection.
 * @param availableEntities - A list of valid entities to guide LLM selection.
 * @param existingLoreIds - A list of valid lore IDs for reference linking.
 * @param existingHistoryIds - A list of valid history IDs for reference linking.
 */
export const createRelationshipRecapSchema = (
	availableKeywords: string[],
	availableTopics: string[],
	availableEntities: string[],
	existingLoreIds: string[],
	existingHistoryIds: string[]
) =>
	z.object({
		content: z.string().describe('The detailed relationship recap content, written in Korean.'),
		keywords: z
			.array(z.string())
			.describe(
				`An array of 5-10 of the most relevant relationship-focused keywords, selected from: [${availableKeywords.join(', ')}]`
			),
		topics: z
			.array(z.string())
			.describe(
				`An array of 3-7 key relationship themes and emotional topics, selected from: [${availableTopics.join(', ')}]`
			),
		entities: z
			.array(z.string())
			.describe(
				`An array of important entities that affected the relationship, selected from: [${availableEntities.join(', ')}]`
			),
		flags: z
			.array(z.string())
			.describe(
				"An array of relationship-specific flags, e.g., ['trust_increased', 'romantic_tension', 'conflict_resolved', 'emotional_breakthrough']"
			),
		loreReferenceList: z
			.array(z.object({ id: z.string(), relevance: z.number().min(0.0).max(1.0) }))
			.describe(
				`A list of relevant lore IDs that influenced the relationship, selected ONLY from this list: [${existingLoreIds.join(', ')}]`
			),
		historyReferenceList: z
			.array(z.object({ id: z.string(), relevance: z.number().min(0.0).max(1.0) }))
			.describe(
				`A list of relevant history IDs that influenced the relationship, selected ONLY from this list: [${existingHistoryIds.join(', ')}]`
			),
	});

export const createNerSchema = () =>
	z.object({
		properNouns: z
			.array(z.string())
			.describe('An array of unique proper nouns extracted from the text.'),
	});

export const RagFilterSchema = z.object({
	entities: z
		.object({
			characters: z
				.array(z.string())
				.optional()
				.describe("A list of character names explicitly mentioned in the user's query."),
			locations: z.array(z.string()).optional().describe('A list of locations or places mentioned.'),
			items: z
				.array(z.string())
				.optional()
				.describe('A list of important items or objects mentioned.'),
		})
		.optional()
		.describe('Key entities identified in the query.'),

	keywords: z
		.array(z.string())
		.optional()
		.describe('A list of single-word keywords from the query.'),

	topics: z
		.array(z.string())
		.optional()
		.describe('A list of broader topics or subjects, which can be multi-word phrases.'),

	emotion: z
		.string()
		.optional()
		.describe(
			"The dominant emotion conveyed by the user's query (e.g., 'angry', 'curious', 'happy')."
		),
	criticalTerm: z
		.string()
		.optional()
		.describe(
			'The single most important noun or proper noun from the query that MUST be present in any relevant document. If no single term is overwhelmingly critical, this should be omitted.'
		),
});
