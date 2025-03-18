import { useState, useEffect, useCallback } from 'react';
import { createAiService } from '@services/aiService';
import { ChatTurn } from '@domain/datasource';

const CHROMA_API_URL = import.meta.env.VITE_CHROMA_API_URL;
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export const useChat = (characterName: string) => {
	const [messages, setMessages] = useState<ChatTurn[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [aiService] = useState(() => createAiService(CHROMA_API_URL || '', OPENAI_API_KEY || ''));

	// Initialize the service with the selected character
	useEffect(() => {
		const initAi = async () => {
			await aiService.initialize(characterName);
		};
		initAi();
	}, [aiService, characterName]);

	const sendMessage = useCallback(
		async (text: string) => {
			// Add user message to UI
			const userTurn: ChatTurn = {
				speaker: 'user',
				entries: [{ type: 'dialogue', text }],
				timestamp: new Date().toISOString(),
			};

			setMessages((prev) => [...prev, userTurn]);
			setIsLoading(true);

			try {
				// Get AI response with memory context
				const responseText = await aiService.chat(text);

				// Add AI response to UI
				const aiTurn: ChatTurn = {
					speaker: 'assistant',
					entries: [{ type: 'dialogue', text: responseText }],
					timestamp: new Date().toISOString(),
				};

				setMessages((prev) => [...prev, aiTurn]);
			} catch (error) {
				console.error('Error getting AI response:', error);
			} finally {
				setIsLoading(false);
			}
		},
		[aiService]
	);

	return { messages, isLoading, sendMessage };
};
