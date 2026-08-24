// src/server/services/personaEngine.ts

import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';

import {
	buildContradictedResponseRevisionPrompt,
	buildLongTermMemoryPrompt,
	buildPersonaResponseContract,
	buildStaticSystemPrompt,
} from '../util/templateUtils.js';
import { buildChatCompletion } from '../util/llmUtils.js';
import { createPersonaResponseSchema } from '../util/schemaUtils.js';
import { flowLogger } from '../util/jsonlLogger.js';
import { parseEntriesToConversation } from '../util/chatParseUtils.js';
import { StructuredOutputValidationError } from '../util/structuredOutputUtils.js';
import { PartialJsonStringDecoder } from '../util/partialJsonUtils.js';
import { MemoryResponse, PersonaResponse } from '@rita-berenice/shared/api';
import { CharacterInfo, ProfileInfo, AiModelInfo, ChatTurn } from '@rita-berenice/shared/domain';
import { llmService } from './llmService.js';

export type PersonaGroundingDecision =
	| 'not_applicable'
	| 'supported'
	| 'contradicted'
	| 'uncertain';

type PersonaGenerationOptions = {
	signal?: AbortSignal;
	adultContentEnabled?: boolean;
	onDelta?: (delta: string) => void;
	onGroundingDecision?: (decision: PersonaGroundingDecision) => void;
};

export const personaEngine = {
	/**
	 * Generates a character's conversational response using a rich, recalled memory context.
	 * This version is refactored to ensure all exceptions are thrown and propagated.
	 *
	 * @returns A promise that resolves to the character's response and emotion.
	 * @throws {Error} Throws any error encountered during LLM invocation or parsing,
	 *                 allowing the caller to handle the exception.
	 */
	async generateResponse(
		recalledMemories: MemoryResponse,
		characterInfo: CharacterInfo,
		profileInfo: ProfileInfo,
		userConversation: string,
		aiModelInfo: AiModelInfo,
		options?: PersonaGenerationOptions
	): Promise<PersonaResponse> {
		const { langCode, shortTermHistory } = recalledMemories;
		const { showName: charName } = characterInfo;
		const { showName: userName } = profileInfo;
		const logContext = {
			userId: profileInfo.userId,
			characterId: characterInfo.characterId,
			sessionId: profileInfo.sessionId,
			model: aiModelInfo.model,
			langCode,
			adultContentEnabled: Boolean(options?.adultContentEnabled),
			streaming: Boolean(options?.onDelta),
		};

		const messages = buildPersonaMessages(
			recalledMemories,
			characterInfo,
			profileInfo,
			userConversation,
			options?.adultContentEnabled
		);

		const personaSchema = createPersonaResponseSchema(charName, userName, langCode);
		flowLogger.info('personaEngine', 'generateResponse.start', {
			...logContext,
			messageCount: messages.length,
			shortTermCount: shortTermHistory.length,
			longTermCount: recalledMemories.longTermHistory.length,
			loreCount: recalledMemories.relevantLore.length,
			historyCount: recalledMemories.relevantHistory.length,
			hasFactualRecap: Boolean(recalledMemories.factualRecapSummary),
			hasRelationshipRecap: Boolean(recalledMemories.relationshipRecapSummary),
		});

		// --- 2. LLM Call and one structured-output repair attempt ---
		try {
			let response = options?.onDelta
				? await (() => {
						const responseDecoder = new PartialJsonStringDecoder('response');
						const groundingDecoder = new PartialJsonStringDecoder('groundingDecision');
						let streamedDecision = '';
						let bufferedResponse = '';
						return llmService
							.streamStructuredLlm(
								messages,
								aiModelInfo,
								profileInfo.userId,
								(rawDelta) => {
									streamedDecision += groundingDecoder.push(rawDelta);
									bufferedResponse += responseDecoder.push(rawDelta);

									if (!isPersonaGroundingDecision(streamedDecision)) return;
									if (streamedDecision === 'contradicted') {
										bufferedResponse = '';
										return;
									}
									if (bufferedResponse) {
										options.onDelta?.(bufferedResponse);
										bufferedResponse = '';
									}
								},
								personaSchema,
								options
							)
							.then((streamedResponse) => {
								if (streamedResponse.groundingDecision !== 'contradicted' && bufferedResponse) {
									options.onDelta?.(bufferedResponse);
								}
								return streamedResponse;
							});
					})()
				: await llmService.invokeStructuredLlm(
						messages,
						aiModelInfo,
						profileInfo.userId,
						personaSchema,
						options
					);

			if (response.groundingDecision === 'contradicted') {
				flowLogger.warn('personaEngine', 'groundingRevision.start', {
					...logContext,
					rejectedResponseLength: response.response.length,
				});
				response = await reviseContradictedResponse(
					messages,
					response.response,
					charName,
					userName,
					langCode,
					aiModelInfo,
					profileInfo.userId,
					personaSchema,
					options
				);
				flowLogger.info('personaEngine', 'groundingRevision.complete', {
					...logContext,
					groundingDecision: response.groundingDecision,
					responseLength: response.response.length,
				});
			}
			flowLogger.info('personaEngine', 'generateResponse.complete', {
				...logContext,
				groundingDecision: response.groundingDecision,
				emotion: response.emotion,
				responseLength: response.response.length,
			});
			options?.onGroundingDecision?.(response.groundingDecision);
			return { response: response.response, emotion: response.emotion };
		} catch (parsingError: unknown) {
			if (!(parsingError instanceof StructuredOutputValidationError)) {
				throw parsingError;
			}

			flowLogger.warn('personaEngine', 'structuredOutput.repairStart', {
				...logContext,
				reason: parsingError.message,
				rawOutputLength: parsingError.rawOutput.length,
			});

			try {
				const repairedResponse = await llmService.repairStructuredLlmOutput(
					parsingError,
					profileInfo.userId,
					personaSchema,
					{
						requiredSchema:
							'{"groundingDecision": "not_applicable | supported | contradicted | uncertain", "response": "string", "emotion": "string"}',
						// Without this the repair ran on DEFAULT_EXTRACTION_MODEL, so a user chatting on
						// Google or OpenRouter had a repair attempt demand an OpenAI key they never had.
						sourceModelInfo: aiModelInfo,
						signal: options?.signal,
					}
				);
				flowLogger.info('personaEngine', 'structuredOutput.repairComplete', {
					...logContext,
					groundingDecision: repairedResponse.groundingDecision,
					emotion: repairedResponse.emotion,
					responseLength: repairedResponse.response.length,
				});
				options?.onGroundingDecision?.(repairedResponse.groundingDecision);
				return { response: repairedResponse.response, emotion: repairedResponse.emotion };
			} catch (correctionError: unknown) {
				flowLogger.error('personaEngine', 'structuredOutput.repairFailed', {
					...logContext,
					originalError: parsingError.message,
					correctionError:
						correctionError instanceof Error ? correctionError.message : 'Unknown correction error',
				});
				throw new Error('Persona structured-output repair failed.', { cause: correctionError });
			}
		}
	},
};

const isPersonaGroundingDecision = (value: string): value is PersonaGroundingDecision =>
	['not_applicable', 'supported', 'contradicted', 'uncertain'].includes(value);

const reviseContradictedResponse = async (
	messages: ChatCompletionMessageParam[],
	rejectedResponse: string,
	characterName: string,
	userName: string,
	langCode: MemoryResponse['langCode'],
	aiModelInfo: AiModelInfo,
	userId: string,
	personaSchema: ReturnType<typeof createPersonaResponseSchema>,
	options?: PersonaGenerationOptions
) => {
	const revisionMessages: ChatCompletionMessageParam[] = [
		...messages,
		buildChatCompletion(
			'system',
			buildContradictedResponseRevisionPrompt(characterName, userName, langCode)
		),
		buildChatCompletion('user', `Rejected draft:\n${rejectedResponse}`),
	];

	if (!options?.onDelta) {
		return llmService.invokeStructuredLlm(
			revisionMessages,
			aiModelInfo,
			userId,
			personaSchema,
			options
		);
	}

	const decoder = new PartialJsonStringDecoder('response');
	return llmService.streamStructuredLlm(
		revisionMessages,
		aiModelInfo,
		userId,
		(rawDelta) => {
			const responseDelta = decoder.push(rawDelta);
			if (responseDelta) options.onDelta?.(responseDelta);
		},
		personaSchema,
		options
	);
};

export const buildPersonaMessages = (
	recalledMemories: MemoryResponse,
	characterInfo: CharacterInfo,
	profileInfo: ProfileInfo,
	userConversation: string,
	adultContentEnabled?: boolean
): ChatCompletionMessageParam[] => {
	const { langCode, shortTermHistory } = recalledMemories;
	const staticSystemPrompt = buildStaticSystemPrompt(
		characterInfo,
		profileInfo,
		langCode,
		adultContentEnabled
	);
	const longTermMemoryContent = buildLongTermMemoryPrompt(recalledMemories, langCode);
	const responseContract = buildPersonaResponseContract(
		characterInfo.showName,
		profileInfo.showName,
		langCode
	);

	return [
		buildChatCompletion('system', staticSystemPrompt),
		...(longTermMemoryContent ? [buildChatCompletion('system', longTermMemoryContent)] : []),
		buildChatCompletion('system', responseContract),
		...buildShortTermHistoryMessages(shortTermHistory),
		buildChatCompletion('user', userConversation, profileInfo.showName),
	];
};

const buildShortTermHistoryMessages = (
	shortTermHistory: ChatTurn[]
): ChatCompletionMessageParam[] => {
	if (!shortTermHistory || shortTermHistory.length === 0) {
		return [];
	}

	// The flatMap function iterates over each turn and builds the corresponding
	// user and assistant messages, creating a flat array perfect for the API.
	return shortTermHistory.flatMap((turn) => {
		const turnMessages: ChatCompletionMessageParam[] = [];

		// Add the user's message part of the turn, if it exists
		if (turn.request?.entries) {
			turnMessages.push(
				buildChatCompletion(
					'user',
					parseEntriesToConversation(turn.request.entries),
					turn.request.showName
				)
			);
		}

		// Add the assistant's (character's) response part of the turn, if it exists
		if (turn.response?.entries) {
			turnMessages.push(
				buildChatCompletion(
					'assistant',
					parseEntriesToConversation(turn.response.entries),
					turn.response.showName
				)
			);
		}

		return turnMessages;
	});
};
