import {
	EmotionKey,
	CharacterMetadata,
	AiModelInfo,
	DEFAULT_IMAGE_NUMBER,
	findClosestEmotion,
	ChatMessage,
} from '#root/src/shared/index.ts';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { llmService } from './llmService.ts';
import { EMOTION_TEMPLATE } from '#root/src/shared/config/llmTemplates.ts';

// Export the response type
export interface PersonaResponse {
	response: string;
	emotion: EmotionKey; // Use the specific type from emotionMapper
}

/**
 * Factory function to create a PersonaEngine instance.
 * Manages persona-based LLM interactions with state managed via closure.
 *
 * @param persona - The character metadata defining the persona.
 * @param aiModelInfo - The AI model configuration to use.
 * @returns An object with methods to interact with the persona engine.
 */
export const createPersonaEngine = (persona: CharacterMetadata, aiModelInfo: AiModelInfo) => {
	// --- State managed by closure ---
	let memory: ChatMessage[] = []; // Use 'let' as it will be reassigned by loadMemory

	// --- Private Helper Function (Internal Message Builder) ---
	const buildPrompt = (userInput: string): ChatCompletionMessageParam[] => {
		const prompt: ChatCompletionMessageParam[] = [];

		// System prompt combining persona and emotion instructions

		// Combine persona instructions with emotion instructions
		prompt.push({
			role: 'system',
			content: `${persona.instructions}\n\n${EMOTION_TEMPLATE}`, // Access persona from closure
		});

		// Add memory (past messages) from closure state
		for (const msg of memory) {
			// Access memory from closure
			// Assuming msg.entries contains text and msg.role is 'user' or 'assistant'
			const content = msg.entries?.map((e) => e.prompt).join('\n') || '';
			if (content && (msg.role === 'user' || msg.role === 'assistant')) {
				// Ensure the role matches the expected type for ChatCompletionMessageParam
				const role = msg.role as 'user' | 'assistant'; // Cast if necessary based on ChatMessage type
				prompt.push({ role, content });
			}
		}

		// Add current user message
		prompt.push({ role: 'user', content: userInput });

		return prompt;
	};

	// --- Public Methods (Returned Object) ---

	/**
	 * Loads prior messages into the engine's memory.
	 * @param messages - An array of chat messages representing conversation history.
	 */
	const loadMemory = (messages: ChatMessage[]): void => {
		// Assign to the 'memory' variable in the closure
		memory = messages;
		console.log(`PersonaEngine loaded ${messages.length} messages into memory.`);
	};

	/**
	 * Sends user input to the LLM, processing the response for text and emotion.
	 * @param userInput - The user's latest message.
	 * @returns A promise resolving to a PersonaResponse object containing the text response and mapped emotion key.
	 */
	const ask = async (userInput: string): Promise<PersonaResponse> => {
		console.log(`PersonaEngine asking with input: "${userInput}"`);
		// Call the internal buildPrompt function
		const messages = buildPrompt(userInput);

		console.log('PersonaEngine invoking LLM with messages:', messages);
		// Call llmService using aiModelInfo from closure
		const rawJsonResponse = await llmService.invokeLlmFromMessages(
			messages,
			aiModelInfo // Access aiModelInfo from closure
		);
		console.log('PersonaEngine received raw response:', rawJsonResponse);

		let parsed: { response: string; emotion: string };

		try {
			// Attempt to parse the raw string as JSON
			parsed = JSON.parse(rawJsonResponse);
			// Validate structure
			if (typeof parsed.response !== 'string' || typeof parsed.emotion !== 'string') {
				throw new Error(
					'Parsed JSON does not match expected structure {response: string, emotion: string}'
				);
			}
		} catch (err: any) {
			console.error(`LLM returned invalid JSON or structure error: ${rawJsonResponse}`, err);
			console.warn('Falling back to using raw response and default emotion.');
			return { response: rawJsonResponse, emotion: DEFAULT_IMAGE_NUMBER };
		}

		// Map the string emotion word to a valid EmotionKey using your utility
		const matchedEmotionKey = findClosestEmotion(parsed.emotion);
		console.log(`PersonaEngine mapped emotion "${parsed.emotion}" to key: ${matchedEmotionKey}`);

		return { response: parsed.response, emotion: matchedEmotionKey };
	};

	// Return the public interface
	return { loadMemory, ask };
};

// Example Usage (conceptual, would be in your API route):
/*
import { characterService } from './characterService'; // Assuming you have this
import { chatHistoryService } from './chatHistoryService'; // Assuming you have this

async function handleChatRequest(sessionId: string, userInput: string, modelInfo: AiModelInfo) {
    const personaData = await characterService.getMetadata(sessionId); // Fetch persona
    const history = await chatHistoryService.getMessages(sessionId); // Fetch history

    const engine = createPersonaEngine(personaData, modelInfo); // Create instance
    engine.loadMemory(history); // Load history

    const result = await engine.ask(userInput); // Get response

    console.log('Response:', result.response);
    console.log('Emotion Key:', result.emotion);
    // ... send result back to client
}
*/
