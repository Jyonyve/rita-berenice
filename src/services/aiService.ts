import { createChatMemoryService } from './chatMemoryService';

export const createAiService = (chromaUrl: string, openAiKey: string) => {
	const { startNewSession, addChatTurn, buildPromptWithMemory, getCurrentSession } =
		createChatMemoryService(chromaUrl, openAiKey);

	const OpenAI = require('openai');
	const openai = new OpenAI({ apiKey: openAiKey });

	return {
		initialize: async (characterName: string): Promise<void> => {
			const sessionId = `${characterName}_${new Date().getTime()}`;
			startNewSession(sessionId);
		},

		chat: async (userMessage: string, model: string = 'gpt-3.5-turbo'): Promise<string> => {
			await addChatTurn('user', userMessage);
			const prompt: string = await buildPromptWithMemory(userMessage);
			const response: string = await callLlmApi(prompt, openai, model);
			await addChatTurn('assistant', response);
			return response;
		},

		getCurrentSession: () => getCurrentSession(),
	};
};

const callLlmApi = async (prompt: string, openai: any, model: string) => {
	const messages = [
		{ role: 'system', content: 'You are a helpful assistant with memory of past conversations.' },
		{ role: 'user', content: prompt },
	];

	const completion = await openai.chat.completions.create({ model, messages });
	return completion.choices[0].message.content;
};
