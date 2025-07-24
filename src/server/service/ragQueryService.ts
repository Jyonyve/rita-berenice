// src/server/services/ragQueryService.ts

import { z } from 'zod';
import { Where } from 'chromadb';
import { llmService } from './llmService.js';
import { correctAiModelInfo } from '#shared/config/supportAiModelInfo.js';
import { AiModelInfo, DefaultAiRole } from '#shared/domain/aimodel/AiInfoTypes.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { RagFilterSchema } from '../util/schemaUtils.js';
import { buildChatCompletion } from '../util/llmUtils.js';

// Type alias for the structured data returned by the LLM
type RagFilterData = z.infer<typeof RagFilterSchema>;

// --- 2. Interface for the Service's Output ---
// This is the object that will be passed to your memory retrieval logic.
export interface TransformedQuery {
	queryTexts: string[];
	metadataFilter?: Where;
	criticalTerm?: string; // The newly identified critical term
}

// Helper to build ChatCompletion messages

export const ragQueryService = {
	/**
	 * Transforms a raw user query into an optimized format for RAG retrieval.
	 * It uses a cost-effective LLM to expand the query and extract metadata for filtering.
	 *
	 * @param userInput - The original query from the user.
	 * @param profileInfo - The user's profile information.
	 * @param originalAiModelInfo - The AI model info for the main response, used to select a corresponding cheap model.
	 * @param langCode - The language code for generating prompts.
	 * @returns A promise resolving to a TransformedQuery object.
	 */
	async transformQuery(
		userInput: string,
		originalAiModelInfo: AiModelInfo,
		userId: string,
		langCode: 'kor' | 'eng' = 'kor'
	): Promise<TransformedQuery> {
		console.log('[ragQueryService] Transforming user query for enhanced retrieval...');

		// --- Use the same logic as personaEngine to select a fast, cheap model ---
		const cheapModelName =
			correctAiModelInfo[originalAiModelInfo.platform][originalAiModelInfo.provider][0];
		const transformationModelInfo: AiModelInfo = {
			...originalAiModelInfo,
			model: cheapModelName,
			maxTokens: 800, // Query transformation should be short and fast
		};

		try {
			// --- Run expansion and extraction in parallel for efficiency ---
			const [expandedQueries, extractedData] = await Promise.all([
				ragQueryService._expandQuery(userInput, transformationModelInfo, userId, langCode),
				// --- Step 2b: Rename this function for clarity ---
				ragQueryService._extractStructuredData(userInput, transformationModelInfo, userId, langCode),
			]);

			// --- Step 2c: Process the full output from the LLM ---
			const metadataFilter = ragQueryService._buildChromaWhereClause(extractedData);
			const criticalTerm = extractedData.criticalTerm;

			const finalQuery: TransformedQuery = {
				queryTexts: [userInput, ...expandedQueries],
				metadataFilter,
				criticalTerm, // Include the critical term in the final object
			};

			console.log('[ragQueryService] Query transformed successfully:', finalQuery);
			return finalQuery;
		} catch (error) {
			console.error(error, 'Query transformation failed. Falling back to raw query.');
			return { queryTexts: [userInput], metadataFilter: undefined };
		}
	},

	/**
	 * @private
	 * Expands a single user query into multiple, semantically related queries.
	 */
	async _expandQuery(
		userInput: string,
		modelInfo: AiModelInfo,
		userId: string,
		langCode: 'kor' | 'eng'
	): Promise<string[]> {
		const prompt =
			langCode === 'kor'
				? `당신은 유능한 검색 쿼리 전문가입니다. 사용자의 다음 질문을 바탕으로, 의미적으로 관련 있지만 표현이 다른 검색 쿼리 2개를 추가로 생성해 주세요. 각 쿼리는 줄바꿈으로 구분해 주세요. 다른 설명은 붙이지 마세요.\n\n사용자 질문: "${userInput}"`
				: `You are an expert search query specialist. Based on the following user query, generate 2 additional, semantically related but differently phrased search queries. Separate each query with a newline. Do not add any other commentary.\n\nUser Query: "${userInput}"`;

		const messages = [buildChatCompletion('user', prompt)];
		const response = await llmService.invokeLlm(messages, modelInfo, userId);

		// Split the response by newlines and filter out any empty strings
		return response.split('\n').filter((q) => q.trim() !== '');
	},

	/**
	 * @private
	 * Extracts filterable metadata from the user query using a Zod schema.
	 */
	async _extractStructuredData(
		userInput: string,
		modelInfo: AiModelInfo,
		userId: string,
		langCode: 'kor' | 'eng'
	): Promise<RagFilterData> {
		// --- Step 2d: Update the prompt to ask for the critical term ---
		const prompt =
			langCode === 'kor'
				? `당신은 텍스트에서 구조화된 데이터를 추출하는 전문가입니다. 다음 사용자 질문을 분석하여, 언급된 캐릭터 이름, 주제, 그리고 답변에 **반드시** 포함되어야 할 가장 중요한 핵심 단어(고유명사 또는 명사구) 하나를 JSON 형식으로 추출해 주세요. 핵심 단어가 없다면 해당 필드는 생략하세요.\n\n사용자 질문: "${userInput}"`
				: `You are an expert at extracting structured data from text. Analyze the following user query and extract any mentioned character names, topics, and the single most important keyword (a proper noun or noun phrase) that MUST be included for an accurate answer. If no such critical term exists, omit the field. Respond in the required JSON format.\n\nUser Query: "${userInput}"`;

		const messages = [buildChatCompletion('user', prompt)];
		const response = await llmService.invokeLlm(
			messages,
			modelInfo,
			userId,
			undefined,
			RagFilterSchema
		);

		return JSON.parse(response) as RagFilterData;
	},

	/**
	 * @private
	 * Converts the extracted data object into a valid ChromaDB 'where' clause.
	 * This version is corrected to only filter on metadata fields that support
	 * exact matching, respecting the primitive-only constraint of ChromaDB metadata.
	 */
	_buildChromaWhereClause(data: RagFilterData): Where | undefined {
		const andConditions: Where[] = [];

		// Filter by character name (assuming a 'characterName' or similar field exists)
		// This is a valid use case for a single-value metadata field.
		if (data.entities?.characters && data.entities.characters.length > 0) {
			// We can only reliably filter if one character is mentioned.
			// Or, if your metadata schema has a 'characterNames' array, this could be `$in`.
			// Sticking to the most robust single-value filter:
			if (data.entities.characters.length === 1) {
				andConditions.push({ characterName: { $eq: data.entities.characters[0] } });
			}
		}

		// Filter by emotion. This is a perfect use case for a single-value field.
		if (data.emotion) {
			// This creates a filter like: "find documents where the user's emotion OR the character's emotion matches".
			andConditions.push({
				$or: [
					{ userEmotionPrimary: { $eq: data.emotion } },
					{ characterEmotionPrimary: { $eq: data.emotion } },
				],
			});
		}

		// NOTE: We deliberately DO NOT filter on 'topics' or 'keywords' here.
		// The vector search itself is the correct tool for matching those concepts.
		// Attempting to filter them from a comma-separated string in a metadata
		// 'where' clause is not supported and would be unreliable.

		if (andConditions.length === 0) {
			return undefined;
		}

		// Wrap all valid conditions in a single $and for a precise search
		return andConditions.length === 1 ? andConditions[0] : { $and: andConditions };
	},
};
