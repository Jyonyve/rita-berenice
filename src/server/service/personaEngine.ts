// src/services/personaEngine.ts
import {
	EmotionKey,
	CharacterInfo,
	AiModelInfo,
	DEFAULT_IMAGE_NUMBER,
	getImageNumberForEmotion,
	ChatMessage,
	parseEntriesToText,
	DEFAULT_LOADING_TURN_COUNT,
	// Add other necessary types/constants
} from '#root/src/shared/index.ts';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { llmService } from './llmService.ts';
// Import template utils
import { EMOTION_TEMPLATE, buildRelationshipContextSystemPrompt } from '../util/templateUtils.ts'; // Adjust path as needed
import { chatService } from './chatService.ts'; // To fetch relationship recap
import { recapService } from './recapService.ts';

export interface PersonaResponse {
	response: string;
	emotion: EmotionKey;
}

export const createPersonaEngine = (
	persona: CharacterInfo, // Contains persona.name (charName) and persona.instructions
	aiModelInfo: AiModelInfo,
	sessionId: string, // Session ID is needed to fetch recaps
	userName: string = 'the user' // User's name/identifier
) => {
	let memory: ChatMessage[] = [];

	const buildPrompt = async (userInput: string): Promise<ChatCompletionMessageParam[]> => {
		const systemPromptParts: string[] = [];

		// 1. Core Persona Instructions
		systemPromptParts.push(persona.instruction);

		// 2. Relationship Context (fetched from chatService)
		const relationshipRecapText = await recapService.getRelationshipRecap(sessionId);
		const relationshipContext = buildRelationshipContextSystemPrompt(
			relationshipRecapText,
			userName,
			persona.name // charName from persona metadata
		);
		if (relationshipContext) {
			systemPromptParts.push(relationshipContext);
		}

		// 3. General Recap (Optional, if you decide to fetch and add it here too)
		// const generalRecapText = await chatService.getRecap(sessionId);
		// if (generalRecapText) {
		//   systemPromptParts.push(`\n[General Conversation Recap]\n"${generalRecapText}"`);
		// }

		// 4. Emotion Template
		systemPromptParts.push(EMOTION_TEMPLATE);

		const finalSystemContent = systemPromptParts.join('\n\n---\n\n'); // Join with a clear separator

		const prompt: ChatCompletionMessageParam[] = [{ role: 'system', content: finalSystemContent }];

		// Add memory (past messages)
		for (const msg of memory) {
			const content = msg.entries?.map((e) => e.prompt).join('\n') || '';
			if (content && (msg.role === 'user' || msg.role === 'assistant')) {
				const role = msg.role as 'user' | 'assistant';
				prompt.push({ role, content });
			}
		}

		prompt.push({ role: 'user', content: userInput });
		return prompt;
	};

	const loadMemory = (messages: ChatMessage[]): void => {
		memory = messages;
		// console.log(`PersonaEngine loaded ${messages.length} messages into memory for session ${sessionId}.`);
	};

	const ask = async (userInput: string): Promise<PersonaResponse> => {
		// console.log(`PersonaEngine (session ${sessionId}) asking with input: "${userInput}" for user "${userName}"`);
		const messages = await buildPrompt(userInput); // buildPrompt is now async

		// console.log(`PersonaEngine (session ${sessionId}) invoking LLM with messages:`, JSON.stringify(messages, null, 2));

		const rawJsonResponse = await llmService.invokeLlmFromMessages(messages, aiModelInfo);
		// console.log(`PersonaEngine (session ${sessionId}) received raw response:`, rawJsonResponse);

		let parsed: { response: string; emotion: string };
		try {
			parsed = JSON.parse(rawJsonResponse);
			if (typeof parsed.response !== 'string' || typeof parsed.emotion !== 'string') {
				throw new Error('Parsed JSON does not match expected structure');
			}
		} catch (err: any) {
			console.error(`LLM (session ${sessionId}) returned invalid JSON: ${rawJsonResponse}`, err);
			return { response: rawJsonResponse, emotion: DEFAULT_IMAGE_NUMBER }; // Fallback
		}

		const matchedEmotionKey = getImageNumberForEmotion(parsed.emotion);
		// console.log(`PersonaEngine (session ${sessionId}) mapped emotion "${parsed.emotion}" to key: ${matchedEmotionKey}`);
		return { response: parsed.response, emotion: matchedEmotionKey };
	};

	/** Builds user' enhanced prompt using recap or fixed logs */
	const buildUserPromptFromLog = async (
		sessionId: string,
		userText: string,
		isFullLogQuery = false
	): Promise<string> => {
		let context = '';
		if (!isFullLogQuery) {
			context = await recapService.getRecap(sessionId); // Try recap first
		}
		if (!context) {
			// Fallback to recent fixed turns
			const turns = await chatService.getRecentChatTurns(sessionId, DEFAULT_LOADING_TURN_COUNT); // Adjust limit as needed
			context = turns
				.map(
					(t) =>
						`Seq ${t.sequence}: User: ${parseEntriesToText(t.request.entries)} Assistant: ${parseEntriesToText(t.response.entries)}`
				)
				.join('\n');
		}
		return context
			? `Use the following context if relevant, otherwise ignore it.\nContext:\n${context}\n\nUser: ${userText}`
			: userText;
	};

	return { loadMemory, ask };
};

// Example Usage (conceptual, where you create the engine):
/*
  async function handleChatRequest(
	sessionId: string,
	userInput: string,
	modelInfo: AiModelInfo,
	characterData: CharacterMetadata, // Includes characterData.name
	userName: string // The name of the user interacting with Tarion
  ) {
	const history = await chatService.getRecentChatTurns(sessionId, 10); // Fetch limited history for engine memory
	// Convert ChatTurn[] to ChatMessage[] if necessary, or adjust createPersonaEngine memory type
	const engineMemory: ChatMessage[] = history.map(turn => ({
		role: 'user', // This needs more sophisticated mapping from ChatTurn to ChatMessage
		entries: turn.request.entries,
		// ... other ChatMessage fields
	})).concat(
	  history.map(turn => ({
		role: 'assistant',
		entries: turn.response.entries,
		// ...
	  }))
	);
  
  
	const engine = createPersonaEngine(characterData, modelInfo, sessionId, userName);
	engine.loadMemory(engineMemory); // Or a more suitable representation of history for the engine's memory
	const result = await engine.ask(userInput);
  
	// ... then you'd call chatService.storeChatTurn, passing characterData.name and userName
	// await chatService.storeChatTurn(newChatTurn, characterData.name, userName);
  }
  */
