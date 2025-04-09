import React, { useState, useCallback } from 'react';
import { Box, Typography, Divider, TextField, Button, CircularProgress } from '@mui/material';
import { ChatTurn, ChatMessage } from '#root/src/shared/domain/chat/index.ts'; // Added ChatMessage
import { useChromaChat, useChat } from '@client/hook/index.ts';
import { buildChatMessage, parseEntriesToText } from '#root/src/shared/util/index.ts';

export const ChatComp: React.FC = () => {
	const [userInput, setUserInput] = useState<string>('');
	const [isProcessing, setIsProcessing] = useState<boolean>(false);

	const {
		recentChatTurn,
		isLoading,
		currentSessionId,
		createChatTurn,
		addChatTurn,
		getResponseFromLlm,
		generateSummary,
		getNextSequence,
	} = useChat();

	const { storeChatTurn, storeSummary, buildUserPromptFromLog } = useChromaChat(currentSessionId);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setUserInput(e.target.value);
	};

	const handleSendMessage = useCallback(async () => {
		if (!userInput.trim() || !currentSessionId || isProcessing) return;

		setIsProcessing(true);

		try {
			const sequence = getNextSequence();
			const userMessage = buildChatMessage('user', sequence, userInput, currentSessionId);

			// Build prompt with context from previous conversations
			const enhancedPrompt = await buildUserPromptFromLog(userInput);

			// Get response from LLM using the enhanced prompt
			const assistantResponse = await getResponseFromLlm(enhancedPrompt);
			const assistantMessage = buildChatMessage(
				'assistant',
				sequence,
				assistantResponse,
				currentSessionId
			);

			const chatTurn = createChatTurn(userMessage, assistantMessage, true);
			addChatTurn(chatTurn);
			await storeChatTurn(chatTurn);

			if (sequence % 3 === 0) {
				const summary = await generateSummary();
				if (summary) {
					await storeSummary(summary);
				}
			}

			setUserInput('');
		} catch (error) {
			console.error('Error sending message:', error);
		} finally {
			setIsProcessing(false);
		}
	}, [
		userInput,
		currentSessionId,
		isProcessing,
		getNextSequence,
		buildUserPromptFromLog,
		getResponseFromLlm,
		createChatTurn,
		addChatTurn,
		storeChatTurn,
		generateSummary,
		storeSummary,
	]);

	const handleRegenerateResponse = useCallback(async () => {
		// Add guard for currentSessionId
		if (isProcessing || recentChatTurn.length === 0 || !currentSessionId) return;

		setIsProcessing(true);

		try {
			const currentTurn = recentChatTurn[recentChatTurn.length - 1];
			const enhancedPrompt = await buildUserPromptFromLog(
				parseEntriesToText(currentTurn.request.entries)
			);
			const newResponse = await getResponseFromLlm(enhancedPrompt);

			const newAssistantMessage = buildChatMessage(
				'assistant',
				currentTurn.sequence,
				newResponse,
				currentSessionId
			);

			const updatedTurn: ChatTurn = { ...currentTurn, response: [newAssistantMessage], isFixed: true };
			addChatTurn(updatedTurn);
			await storeChatTurn(updatedTurn);
		} catch (error) {
			console.error('Error regenerating response:', error);
		} finally {
			setIsProcessing(false);
		}
	}, [
		isProcessing,
		recentChatTurn,
		buildUserPromptFromLog,
		getResponseFromLlm,
		currentSessionId,
		addChatTurn,
		storeChatTurn,
	]);

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', width: 400, margin: 'auto' }}>
			<Typography variant="h5" gutterBottom>
				Chat
			</Typography>

			<Box sx={{ overflowY: 'auto', maxHeight: 400, marginBottom: 2 }}>
				{recentChatTurn.map((turn) => (
					<Box key={turn.sequence} sx={{ marginBottom: 1 }}>
						<Typography variant="body1" color="primary">
							<strong>{turn.request.role}:</strong> {parseEntriesToText(turn.request.entries)}
						</Typography>
						{turn.response.map(
							(
								response: ChatMessage,
								index: number // Added types here
							) => (
								<Typography key={index} variant="body1" color="text.secondary">
									<strong>{response.role}:</strong> {parseEntriesToText(response.entries)}
								</Typography>
							)
						)}
					</Box>
				))}
				{isProcessing && (
					<Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
						<CircularProgress size={24} />
					</Box>
				)}
			</Box>

			<Divider />

			<TextField
				value={userInput}
				onChange={handleInputChange}
				onKeyDown={handleKeyPress}
				label="Your message"
				variant="outlined"
				multiline
				rows={2}
				fullWidth
				sx={{ marginY: 2 }}
				disabled={isProcessing || isLoading}
			/>

			<Box sx={{ display: 'flex', gap: 2 }}>
				<Button
					onClick={handleSendMessage}
					variant="contained"
					color="primary"
					fullWidth
					disabled={isProcessing || isLoading || !userInput.trim()}
				>
					Send
				</Button>
				<Button
					onClick={handleRegenerateResponse}
					variant="outlined"
					color="secondary"
					fullWidth
					disabled={isProcessing || isLoading || recentChatTurn.length === 0}
				>
					Regenerate
				</Button>
			</Box>
		</Box>
	);
};
