import OpenAI from 'openai';
import { ChatCompletion } from 'openai/resources/index.mjs';
import { ChromaResponse } from '#shared/api/ModuleResponse.js';
import { DefaultAiRole } from '#shared/domain/aimodel/index.js';
import { HistoryContext, HistoryInfo, LoreContext, LoreInfo } from '#shared/domain/lore/index.js';
import { LlmResponseParseError } from '#shared/domain/error/errors.js';
import { logFlow } from './jsonlLogger.js';
import { ChatEntry } from '#shared/domain/chat/ChatInterfaces.js';
import { parseEntriesToText } from '#shared/util/parseUtils.js';

export function isDirectOpenAIClient(llm: any): llm is OpenAI {
	// Check for a unique property or method of the OpenAI client instance
	// that Langchain BaseChatModel instances won't have.
	// '.chat.completions.create' is a reasonably safe indicator.
	return llm && typeof llm === 'object' && llm.chat?.completions?.create;
}

export const extractValidOpenAiContent = (response: ChatCompletion): string => {
	if (!response?.choices?.length) return '';
	const validChoice = response.choices.find((choice) => choice?.message?.content != null);
	return validChoice?.message?.content || '';
};

/**
 * Safely extracts a JSON object from a raw LLM string response, which might be
 * wrapped in markdown code blocks (e.g., ``````).
 *
 * This function is generic and can be typed by the caller to ensure the parsed
 * object matches an expected interface.
 *
 * @param llmResponse The raw string response from the LLM.
 * @param callerContext A string to identify the calling function for better error logging.
 * @returns A parsed object of type T, or null if parsing fails.
 */

/**
 * Safely extracts a JSON object from a raw LLM string response.
 * Throws a specific, catchable error if the response is empty, malformed,
 * or cannot be parsed.
 *
 * @param llmResponse The raw string response from the LLM.
 * @param callerContext A string to identify the calling function for better error logging.
 * @returns A parsed object of type T.
 * @throws {LlmResponseParseError} If parsing fails at any stage.
 */

export const parseLlmJsonResponse = <T>(
	llmResponse: string,
	callerContext: string = 'LLM Parser'
): T => {
	if (!llmResponse) {
		throw new LlmResponseParseError('NOT_FOUND', callerContext, 'Empty or null response.');
	}

	const JSON_REGEX = /``````/;
	let extractedJson = '';

	const match = llmResponse.match(JSON_REGEX);
	if (match && match[1]) {
		extractedJson = match[1];
	} else if (llmResponse.trim().startsWith('{')) {
		extractedJson = llmResponse;
	} else {
		throw new LlmResponseParseError('NOT_FOUND', callerContext, llmResponse);
	}

	try {
		return JSON.parse(extractedJson) as T;
	} catch (error: any) {
		// Pass the specific JSON.parse error message for the corrective prompt
		console.log(`[parseLlmJsonResponse] : ${llmResponse}`);
		throw new LlmResponseParseError('MALFORMED_SYNTAX', callerContext, llmResponse);
	}
};

/**
 * Sanitizes and parses raw LLM response text into an array of structured ChatEntry objects.
 * - It distinguishes between narration (action) and dialogue.
 * - Consecutive lines of the same type are grouped into a single entry.
 *
 * @param text The raw string response from the LLM.
 * @returns An array of ChatEntry objects.
 */
export const sanitizeLlmResponse = (text: string): string => {
	logFlow('TextTransform', 'Starting text parsing to ChatEntry[]', {
		inputLength: text.length,
		preview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
	});

	if (!text || text.trim() === '') {
		return '';
	}

	// Step 1: Split text into individual lines, trimming and removing empty lines.
	const lines = text
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	// Step 2: Classify each line as 'dialogue' or 'action'.
	const classifiedLines: ChatEntry[] = lines.map((line) => {
		// Heuristic: A line is dialogue if it starts with a quote or common dialogue markers.
		const isDialogue = line.startsWith('"');
		// Clean the line by removing surrounding quotes for a clean prompt.
		const prompt = isDialogue ? line.replace(/^"|"$/g, '').trim() : line;
		const type = isDialogue ? 'dialogue' : 'action';
		return { type, prompt };
	});

	// Step 3: Group consecutive lines of the same type into blocks.
	if (classifiedLines.length === 0) {
		return '';
	}

	const groupedBlocks: ChatEntry[] = [];
	let currentBlock = { ...classifiedLines[0] };

	for (let i = 1; i < classifiedLines.length; i++) {
		const line = classifiedLines[i];
		if (line.type === currentBlock.type) {
			// If the line type is the same, append its content to the current block.
			currentBlock.prompt += `\n${line.prompt}`;
		} else {
			// If the type changes, push the completed block and start a new one.
			groupedBlocks.push(currentBlock);
			currentBlock = { ...line };
		}
	}
	// Add the last remaining block to the array.
	groupedBlocks.push(currentBlock);

	// Step 4: Convert each block into a ChatEntry object.
	const chatEntries: ChatEntry[] = groupedBlocks.map((block) => ({
		type: block.type,
		prompt: block.prompt,
	}));

	logFlow('TextTransform', 'Text parsing completed', {
		outputEntryCount: chatEntries.length,
		result: chatEntries,
	});

	return parseEntriesToText(chatEntries);
};

/**
 * Re-ranks ChromaDB results based on a combination of semantic distance and recency.
 * @param response The raw response from a ChromaDB query.
 * @param decayRate A factor controlling how quickly older items lose relevance (e.g., 0.1).
 * @returns The same ChromaResponse object, but with its contents sorted by the new combined score.
 */
export function reRankByRecency<T extends { updatedAt: string }>(
	response: ChromaResponse & { contents?: T[] }, // Assuming a generic response with a content array
	decayRate: number = 0.05
): ChromaResponse & { contents?: T[] } {
	if (!response.documents || !response.distances || !response.contents) {
		return response; // Not enough data to rank
	}

	const now = Date.now();
	const rankedItems = (response.distances[0] || [])
		.map((distance, index) => {
			const item = response.contents![index];
			const ageInDays = (now - Date.parse(item.updatedAt)) / (1000 * 60 * 60 * 24);

			// 1. Normalize semantic distance (lower is better) to a score (higher is better)
			const semanticScore = 1 / (1 + distance);

			// 2. Calculate recency score using exponential decay
			const recencyScore = Math.exp(-decayRate * ageInDays);

			// 3. Combine the scores. Adjust weighting as needed.
			const combinedScore = semanticScore * 0.7 + recencyScore * 0.3;

			return {
				id: response.ids[index],
				document: response.documents![index],
				metadata: response.metadatas![index],
				content: item,
				combinedScore,
			};
		})
		.sort((a, b) => b.combinedScore - a.combinedScore); // Sort descending by combined score

	// Reconstruct the ChromaResponse object with the sorted data
	return {
		ids: rankedItems.map((item) => item.id),
		documents: rankedItems.map((item) => item.document),
		metadatas: rankedItems.map((item) => item.metadata),
		contents: rankedItems.map((item) => item.content),
		// Note: distances are no longer meaningful after re-ranking
	};
}

export const buildChatCompletion = (role: DefaultAiRole, content: string, name?: string) => {
	return { role, content, name };
};

// CORRECT mapping for Histories
export const mapHistoryContexts = (historyInfos: HistoryInfo[]): HistoryContext[] =>
	historyInfos.map((history) => {
		return {
			// --- Explicitly list only the fields you need ---
			historyId: history.historyId,
			title: history.title,
			summary: history.summary,
			category: history.category,
			periodLabel: history.periodLabel,
			keywordList: history.keywordList,
			topicList: history.topicList,
			entityList: history.entityList,
			allAffectedCharacterIdList: history.allAffectedCharacterIdList,
		};
	});

// CORRECT mapping for Lore
export const mapLoreContexts = (loreInfos: LoreInfo[]): LoreContext[] =>
	loreInfos.map((lore) => {
		return {
			loreId: lore.loreId,
			title: lore.title,
			summary: lore.summary,
			category: lore.category,
			keywordList: lore.keywordList,
			topicList: lore.topicList,
			entityList: lore.entityList,
			allAffectedCharacterIdList: lore.allAffectedCharacterIdList,
		};
	});
