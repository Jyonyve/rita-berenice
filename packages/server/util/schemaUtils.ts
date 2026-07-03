import { curatedEmotionKeywords } from '@rita-berenice/shared/config';
import { SupportAiModelList } from '@rita-berenice/shared/domain';
import { convertArrayToString } from '@rita-berenice/shared/util';
import z from 'zod';

const metadataTypeSchema = z.string().optional();

const chatEntrySchema = z.object({
	type: z.enum(['dialogue', 'action']),
	prompt: z.string().min(1),
});

const chatMessageSchema = z
	.object({
		sessionId: z.string().min(1),
		sequence: z.number().int().nonnegative(),
		messageType: z.enum(['request', 'response']),
		role: z.enum(['system', 'user', 'assistant']),
		showName: z.string().min(1),
		messageId: z.string().min(1),
		createdAt: z.string().min(1),
		updatedAt: z.string().min(1),
		emotion: z.string().min(1),
		type: metadataTypeSchema,
		model: z.string().optional(),
		entries: z.array(chatEntrySchema).min(1),
	})
	.passthrough();

export const TempChatTurnCdoSchema = z
	.object({
		sessionId: z.string().min(1),
		sequence: z.number().int().nonnegative(),
		userId: z.string().min(1),
		inputJsonString: z.string().min(1),
	})
	.passthrough();

export const CharacterInfoSchema = z
	.object({
		characterId: z.string().min(1),
		userId: z.string().min(1),
		name: z.string().min(1),
		showName: z.string().min(1),
		gender: z.string().min(1),
		title: z.string(),
		description: z.string(),
		instruction: z.string(),
		worldLoreId: z.string(),
		firstMessage: z.string(),
	})
	.passthrough();

export const ProfileInfoSchema = z
	.object({
		profileId: z.string().min(1),
		sessionId: z.string().min(1),
		userId: z.string().min(1),
		name: z.string().min(1),
		showName: z.string().min(1),
		gender: z.string().min(1),
		title: z.string(),
		description: z.string(),
	})
	.passthrough();

export const AiModelInfoSchema = z
	.object({
		platform: z.string().min(1),
		provider: z.string().min(1),
		model: z.string().min(1),
		temperature: z.number().optional(),
		maxTokens: z.number().int().positive(),
	})
	.passthrough();

export const ReceiveBotResponseBodySchema = z
	.object({
		sessionId: z.string().min(1),
		sequence: z.number().int().nonnegative(),
		entries: z.array(chatEntrySchema).min(1),
		modelName: z
			.string()
			.refine((modelName) => SupportAiModelList.includes(modelName as never), {
				message: 'Unsupported AI model.',
			}),
		isScene: z.boolean().optional(),
	})
	.strict();

export const ChatTurnCdoSchema = z
	.object({
		userId: z.string().min(1),
		sessionId: z.string().min(1),
		sequence: z.number().int().nonnegative(),
		request: chatMessageSchema,
		response: chatMessageSchema,
	})
	.passthrough()
	.superRefine((turn, context) => {
		const messages = [
			{ key: 'request', value: turn.request, expectedType: 'request', expectedRole: 'user' },
			{ key: 'response', value: turn.response, expectedType: 'response', expectedRole: 'assistant' },
		] as const;

		for (const message of messages) {
			if (message.value.sessionId !== turn.sessionId || message.value.sequence !== turn.sequence) {
				context.addIssue({
					code: 'custom',
					path: [message.key],
					message: 'Message session and sequence must match the chat turn.',
				});
			}
			if (
				message.value.messageType !== message.expectedType ||
				message.value.role !== message.expectedRole
			) {
				context.addIssue({
					code: 'custom',
					path: [message.key],
					message: 'Message type and role do not match the chat turn position.',
				});
			}
		}
	});

// Safe type guard to ensure non-empty array
function ensureNonEmptyArray<T>(arr: T[]): asserts arr is [T, ...T[]] {
	if (arr.length === 0) {
		throw new Error('Array cannot be empty for z.enum()');
	}
}

// Create emotion enum safely
const createEmotionList = () => {
	const emotions = [...curatedEmotionKeywords]; // Create a copy
	ensureNonEmptyArray(emotions);
	return emotions;
};

const emotionList = createEmotionList();

/**
 * Creates an efficient Zod schema for persona responses with minimal token overhead.
 * Focuses on structure validation rather than verbose instructions.
 */
export const createPersonaResponseSchema = (
	charName: string,
	userName: string,
	langCode: 'kor' | 'eng' = 'kor'
) =>
	z
		.object({
			response: z
				.string()
				.describe(
					langCode === 'kor'
						? `${charName}의 3인칭 서술. 1000-2000자. 서술은 '~다'로 끝남. 문단 변경, 대화시 줄바꿈(\\n) 사용.`
						: `Third-person narration for ${charName}. 1000-2000 chars. Use \\n between narration/dialogue/paragraph.`
				),
			emotion: z.enum(emotionList).describe('Single emotion word from the provided list.'),
		})
		.describe(
			langCode === 'kor'
				? `${charName} 캐릭터의 응답 구조. 3인칭 서술과 감정을 포함한 JSON 객체.`
				: `Response structure for character ${charName}. JSON object containing third-person narration and emotion.`
		);

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

	return z
		.object({
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
						`The primary emotion of ${userEng}. MUST be one of the following: [${convertArrayToString(emotionList)}]`
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
						`The primary emotion of ${charEng}. MUST be one of the following: [${convertArrayToString(emotionList)}]`
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
		})
		.describe(
			`Chat turn metadata schema: Structured analysis of conversation between ${charEng} and ${userEng}, including emotions, entities, relationships, and RAG-ready memory chunk.`
		);
};

/**
 * Creates a comprehensive Zod schema for validating all metadata of a LORE entry.
 * Aligns directly with the LoreInfo interface.
 */
export const createLoreMetadataSchema = (availableCharacterIds: string[]) => {
	return z
		.object({
			// Core Identification
			generatedTitle: z
				.string()
				.describe('A concise, descriptive title in English for the lore entry. Maximum 3 words.'),
			summary: z
				.string()
				.describe('A one-paragraph summary of the lore, explaining its significance.'),
			category: z
				.enum([
					'Mythology', // Legends, creation stories, religious beliefs
					'Item', // Magical items, artifacts, important objects
					'Concept', // Abstract ideas, philosophies, systems
					'Organization', // Groups, factions, institutions
					'Character', // Important NPCs, legendary figures
					'Location', // Places, regions, landmarks
					'Event', // Historical events, disasters, celebrations
					'Culture', // Customs, traditions, social norms
					'Magic', // Spells, magical phenomena, arcane knowledge
					'History', // Historical records, timelines
					'Technology', // Inventions, crafts, techniques
					'Politics', // Government systems, laws, treaties
					'Other', // Fallback for unique cases
				])
				.describe("A category for the lore, e.g., 'Mythology', 'Item', 'Concept', 'Organization'."),
			source: z
				.string()
				.describe("Where this lore originates from, e.g., 'Ancient Texts', 'Character Dialogue'."),
			// Character Involvement
			sideCharacterIdList: z
				.array(z.string())
				.describe(
					`Other characters significantly related to this lore. MUST be chosen from: [${convertArrayToString(
						availableCharacterIds
					)}]`
				),

			// Searchable Indexable Lists
			keywordList: z.array(z.string()).describe('An array of 3-5 specific keywords for search.'),
			topicList: z.array(z.string()).describe('An array of 1-3 broader themes or topics.'),
			entityList: z
				.array(z.string())
				.describe('An array of named entities mentioned (people, places, items).'),
		})
		.describe(
			'Lore metadata schema: Structured world-building information including title, summary, categorization, and searchable metadata for RAG system integration.'
		);
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

	return z
		.object({
			// Core Identification
			generatedTitle: z
				.string()
				.describe('A concise, descriptive title in English for the event. Maximum 3 words.'),
			summary: z
				.string()
				.describe('A one-paragraph summary of the event, capturing the key actions and outcomes.'),
			category: z
				.enum([
					'Origin Story',
					'Major Life Event',
					'Relationship Turnpoint',
					'Career & Faction',
					'Conflict & War',
					'Internal Struggle',
					'Other',
				])
				.describe(
					'Classify the event into one of the following predefined categories. Choose the one that best fits the main theme of the story.'
				),
			// Character Involvement
			sideCharacterIdList: z
				.array(z.string())
				.describe(
					`Other characters involved in the event. MUST be chosen from: [${convertArrayToString(
						availableCharacterIds
					)}]`
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
								`The exact title of a related event. MUST be one of: [${convertArrayToString(
									existingEventTitles
								)}]`
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
		})
		.describe(
			'History metadata schema: Structured character backstory and timeline information including events, dates, relationships, and searchable metadata for RAG system integration.'
		);
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
	z
		.object({
			content: z.string().describe('The detailed factual ledger content, written in Korean.'),
			keywords: z
				.array(z.string())
				.describe(
					`An array of 5-10 of the most relevant factual keywords, selected from: [${convertArrayToString(
						availableKeywords
					)}]`
				),
			topics: z
				.array(z.string())
				.describe(
					`An array of 3-7 key factual themes, selected from: [${convertArrayToString(availableTopics)}]`
				),
			entities: z
				.array(z.string())
				.describe(
					`An array of important entities, selected from: [${convertArrayToString(availableEntities)}]`
				),
			flags: z
				.array(z.string())
				.describe(
					"An array of fact-specific flags, e.g., ['new_lore_revealed', 'character_background_disclosed', 'plot_advancement']"
				),
			loreReferenceList: z
				.array(z.object({ id: z.string(), relevance: z.number().min(0.0).max(1.0) }))
				.describe(
					`A list of relevant lore IDs, selected ONLY from this list: [${convertArrayToString(
						existingLoreIds
					)}]`
				),
			historyReferenceList: z
				.array(z.object({ id: z.string(), relevance: z.number().min(0.0).max(1.0) }))
				.describe(
					`A list of relevant history IDs, selected ONLY from this list: [${convertArrayToString(
						existingHistoryIds
					)}]`
				),
		})
		.describe(
			'Factual recap schema: Structured summary of key facts and events from recent conversations, organized for knowledge management and RAG system integration.'
		);

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
	z
		.object({
			content: z.string().describe('The detailed relationship recap content, written in Korean.'),
			keywords: z
				.array(z.string())
				.describe(
					`An array of 5-10 of the most relevant relationship-focused keywords, selected from: [${convertArrayToString(
						availableKeywords
					)}]`
				),
			topics: z
				.array(z.string())
				.describe(
					`An array of 3-7 key relationship themes and emotional topics, selected from: [${convertArrayToString(
						availableTopics
					)}]`
				),
			entities: z
				.array(z.string())
				.describe(
					`An array of important entities that affected the relationship, selected from: [${convertArrayToString(
						availableEntities
					)}]`
				),
			flags: z
				.array(z.string())
				.describe(
					"An array of relationship-specific flags, e.g., ['trust_increased', 'romantic_tension', 'conflict_resolved', 'emotional_breakthrough']"
				),
			loreReferenceList: z
				.array(z.object({ id: z.string(), relevance: z.number().min(0.0).max(1.0) }))
				.describe(
					`A list of relevant lore IDs that influenced the relationship, selected ONLY from this list: [${convertArrayToString(
						existingLoreIds
					)}]`
				),
			historyReferenceList: z
				.array(z.object({ id: z.string(), relevance: z.number().min(0.0).max(1.0) }))
				.describe(
					`A list of relevant history IDs that influenced the relationship, selected ONLY from this list: [${convertArrayToString(
						existingHistoryIds
					)}]`
				),
		})
		.describe(
			'Relationship recap schema: Structured analysis of character relationship dynamics, emotional evolution, and interpersonal developments for RAG system integration.'
		);

export const createNerSchema = () =>
	z
		.object({
			properNouns: z
				.array(z.string())
				.describe('An array of unique proper nouns extracted from the text.'),
		})
		.describe(
			'Named Entity Recognition schema: Structured extraction of proper nouns from text for terminology management and glossary building.'
		);

export const RagFilterSchema = z
	.object({
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
	})
	.describe(
		'RAG filter schema: Structured analysis of user query for semantic search, including entities, emotions, topics, and critical terms for memory retrieval.'
	);

export const FilterCriteriaSchema = z
	.object({
		entities: z
			.object({
				characters: z.array(z.string()).optional().describe('List of character names in English.'),
				locations: z.array(z.string()).optional().describe('List of location names in English.'),
				items: z.array(z.string()).optional().describe('List of item names in English.'),
			})
			.optional(),
		emotion: z.string().optional().describe("User's dominant emotion in English."),
		topics: z.array(z.string()).optional().describe('List of topics in English.'),
		keywords: z.array(z.string()).optional().describe('List of keywords in English.'),
		criticalTerm: z.string().optional().describe('A single, critical English search term.'),
		period: z
			.string()
			.optional()
			.describe("The relevant time period, in English (e.g., 'Childhood', 'Reign')."),
	})
	.describe(
		'Filter criteria schema: English-normalized search parameters for ChromaDB metadata filtering and RAG system querying.'
	);

// This is the data structure that will be passed to chatStore
export type FilterCriteria = z.infer<typeof FilterCriteriaSchema>;
