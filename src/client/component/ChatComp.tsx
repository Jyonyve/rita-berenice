// src/client/components/ChatComp.tsx
import React, { useState, useCallback, useEffect, FC } from 'react'; // Add React
import { useChatServer, useChatClient, useAiModel, useCredential } from '@client/hook/index.ts';
// REMOVE: DEFAULT_SUMMARY_INTERVAL, DEFAULT_QUERY_LIMIT
import { ChatTurn, ChatMessage } from '@shared/index.ts'; // Import types directly if needed
import { buildChatMessage, parseEntriesToText } from '#root/src/shared/util/index.ts';
import { CircularProgress, Divider, TextField, Button, Typography, Paper } from '@mui/material'; // Import Typography
import { Stack, Box } from '@mui/system';

export const ChatComp: FC = () => {
	const [userInput, setUserInput] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [errorState, setErrorState] = useState(''); // <-- Add error state

	// === Hooks ===
	const {
		recentChatTurn,
		isLoading: isHistoryLoading,
		currentSessionId,
		createChatTurn,
		addChatTurn,
		getCurrentSequence,
		getNextSequence,
		loadChatHistory,
		changeSessionId, // Assuming this is needed to set the initial ID
	} = useChatClient();

	const { storeChatTurn, buildUserPromptFromLog, genResponseFromLlm } =
		useChatServer(currentSessionId);

	const { aiModelInfo } = useAiModel();
	const { credential, isLoading: isLoadingCredentials, error: credentialError } = useCredential();

	useEffect(() => {
		if (currentSessionId) {
			changeSessionId(currentSessionId);
			loadChatHistory(currentSessionId);
		}
		setUserInput(''); // Clear input when session changes
	}, [currentSessionId, loadChatHistory]);

	// === Event Handlers ===
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setUserInput(e.target.value);

	const handleSendMessage = useCallback(async () => {
		setErrorState(''); // Clear previous errors
		// --- Pre-send Checks ---
		if (
			!userInput.trim() ||
			!currentSessionId ||
			isProcessing ||
			isLoadingCredentials ||
			credentialError ||
			!credential ||
			Object.keys(credential).length === 0 ||
			!aiModelInfo
		) {
			// Set specific errorState messages based on the condition
			if (isLoadingCredentials) setErrorState('Checking credentials...');
			else if (credentialError) setErrorState(`Credential Error: ${credentialError.message}`);
			else if (!credential || Object.keys(credential).length === 0)
				setErrorState('Credentials not configured.');
			else if (!aiModelInfo) setErrorState('AI Model not selected.');
			else if (!currentSessionId) setErrorState('No active session.');
			// else ignore empty input or already processing
			return;
		}
		// --- End Checks ---

		setIsProcessing(true);
		const sequence = getNextSequence();

		try {
			const userMessage = buildChatMessage('user', sequence, userInput, currentSessionId);
			const enhancedPrompt = await buildUserPromptFromLog(userInput);

			// Call Backend for Response
			const response = await genResponseFromLlm('user', enhancedPrompt, aiModelInfo); // Corrected body
			const { assistantResponse } = response;

			const assistantMessage = buildChatMessage(
				'assistant',
				sequence,
				assistantResponse,
				currentSessionId
			);
			const chatTurn = createChatTurn(userMessage, assistantMessage, false);

			addChatTurn(chatTurn); // Update client state
			await storeChatTurn(chatTurn); // Store remotely (triggers server recap)

			setUserInput('');
		} catch (error: any) {
			const message = error.response?.data?.message || error.message || 'Failed to get response.';
			setErrorState(`Error: ${message}`); // Set error state for UI
		} finally {
			setIsProcessing(false);
		}
	}, [
		// Dependencies - REMOVE summary related ones
		userInput,
		currentSessionId,
		isProcessing,
		isLoadingCredentials,
		credentialError,
		credential,
		aiModelInfo,
		getNextSequence,
		buildUserPromptFromLog,
		genResponseFromLlm,
		createChatTurn,
		addChatTurn,
		storeChatTurn,
	]);

	const handleRegenerateResponse = useCallback(async () => {
		setErrorState('');
		// --- Pre-send Checks ---
		if (
			isProcessing ||
			recentChatTurn.length === 0 ||
			!currentSessionId ||
			isLoadingCredentials ||
			credentialError ||
			!credential ||
			Object.keys(credential).length === 0 ||
			!aiModelInfo
		) {
			setErrorState('Cannot regenerate now.');
			return;
		}
		// --- End Checks ---

		setIsProcessing(true);
		const turnToRegen = recentChatTurn[recentChatTurn.length - 1];
		const sequence = getCurrentSequence();

		try {
			const userMessage = buildChatMessage('user', sequence, userInput, currentSessionId);
			const enhancedPrompt = await buildUserPromptFromLog(userInput);

			// Call Backend for New Response
			const response = await genResponseFromLlm('user', enhancedPrompt, aiModelInfo); // Corrected body
			const { assistantResponse: newResponse } = response;

			const newAssistantMessage = buildChatMessage(
				'assistant',
				sequence,
				newResponse,
				currentSessionId
			);
			const updatedTurn: ChatTurn = { ...turnToRegen, response: [newAssistantMessage], isFixed: true };

			addChatTurn(updatedTurn); // Update client state
			await storeChatTurn(updatedTurn); // Store remotely (triggers server recap)
		} catch (error: any) {
			const message =
				error.response?.data?.message || error.message || 'Failed to regenerate response.';
			setErrorState(`Error: ${message}`); // Set error state
		} finally {
			setIsProcessing(false);
		}
	}, [
		// Dependencies - REMOVE summary related ones
		isProcessing,
		isLoadingCredentials,
		credentialError,
		credential,
		aiModelInfo,
		recentChatTurn,
		currentSessionId,
		buildUserPromptFromLog,
		genResponseFromLlm,
		addChatTurn,
		storeChatTurn,
	]);

	// --- Render ---
	return (
		<Stack spacing={2} sx={{ p: 2, height: '100%', boxSizing: 'border-box' }}>
			{/* ... Header ... */}
			<Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2 }}>
				{isHistoryLoading && <CircularProgress />}
				{recentChatTurn.map((turn, turnIndex) => (
					<Paper key={`${turn.sequence}-${turnIndex}`} elevation={1} sx={{ p: 1.5, mb: 1.5 }}>
						{/* Display turn content */}
						<Typography variant="body2">Seq: {turn.sequence}</Typography>
						<Typography variant="body1">User: {parseEntriesToText(turn.request.entries)}</Typography>
						{turn.response?.map((res, idx) => (
							<Typography key={idx} variant="body1" sx={{ mt: 1 }}>
								Assistant: {parseEntriesToText(res.entries)}
							</Typography>
						))}
					</Paper>
				))}
				{/* Status indicators */}
				{isProcessing && <CircularProgress size={24} sx={{ display: 'block', mx: 'auto' }} />}
				{errorState && (
					<Typography color="error" sx={{ mt: 1 }}>
						{errorState}
					</Typography>
				)}
				{isLoadingCredentials && <Typography color="text.secondary">Loading credentials...</Typography>}
				{credentialError && (
					<Typography color="error">Credential Error: {credentialError.message}</Typography>
				)}
			</Box>
			<Divider />
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 'auto', pt: 2 }}>
				<TextField
					fullWidth
					variant="outlined"
					placeholder="Type your message..."
					value={userInput}
					onChange={handleInputChange}
					multiline
					maxRows={5}
					disabled={isProcessing || isLoadingCredentials}
					error={!!errorState || !!credentialError}
					helperText={errorState || credentialError?.message || ' '}
				/>
				<Button
					variant="outlined"
					onClick={handleSendMessage}
					disabled={
						isProcessing ||
						!userInput.trim() ||
						isLoadingCredentials ||
						!!credentialError ||
						!credential ||
						Object.keys(credential).length === 0
					}
				>
					Edit
				</Button>
				<Button
					variant="contained"
					onClick={handleSendMessage}
					disabled={
						isProcessing ||
						!userInput.trim() ||
						isLoadingCredentials ||
						!!credentialError ||
						!credential ||
						Object.keys(credential).length === 0
					}
				>
					Send
				</Button>
				<Button
					variant="outlined"
					onClick={handleRegenerateResponse}
					disabled={
						isProcessing ||
						recentChatTurn.length === 0 ||
						isLoadingCredentials ||
						!!credentialError ||
						!credential ||
						Object.keys(credential).length === 0
					}
				>
					Regen
				</Button>
			</Box>
		</Stack>
	);
};
