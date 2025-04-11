// src/client/components/ChatComp.tsx
import React, { useState, useCallback, useEffect } from 'react'; // Add React
import { useChatServer, useChatClient, useAiModel, useCredential } from '@client/hook/index.ts';
// REMOVE: DEFAULT_SUMMARY_INTERVAL, DEFAULT_QUERY_LIMIT
import { ChatTurn, useErrorDialog, BasicLlmRequestFormat } from '@shared/index.ts';
import { buildChatMessage, parseEntriesToText } from '#root/src/shared/util/index.ts';
import { CircularProgress, Divider, TextField, Button, Typography } from '@mui/material'; // Import Typography
import { Stack, Box } from '@mui/system';

export const ChatComp: React.FC = () => {
	const [userInput, setUserInput] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);

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
	const { showError } = useErrorDialog();

	// Example: Set initial Session ID (replace with your actual logic)
	useEffect(() => {
		const initialId = 'session_test_123'; // Get from URL, state, etc.
		changeSessionId(initialId);
	}, [changeSessionId]);

	useEffect(() => {
		if (currentSessionId) {
			loadChatHistory(currentSessionId);
		}
		setUserInput(''); // Clear input when session changes
	}, [currentSessionId, loadChatHistory]);

	// === Event Handlers ===
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setUserInput(e.target.value);

	const handleSendMessage = useCallback(async () => {
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
			if (credentialError) showError(`Credential Error: ${credentialError.message}`);
			else if (!aiModelInfo) showError('AI Model not selected.');
			else if (!currentSessionId) showError('No active session.');
			return;
		}
		// --- End Checks ---

		setIsProcessing(true);
		const sequence = getNextSequence();

		try {
			const userMessage = buildChatMessage('user', sequence, userInput, currentSessionId);
			const enhancedPrompt = await buildUserPromptFromLog(userInput);

			// Call Backend for Response
			const response = await genResponseFromLlm('user', enhancedPrompt, aiModelInfo);
			const { assistantResponse } = response;

			if (!assistantResponse) {
				showError(`failed to gen llm response: ${assistantResponse}`);
				return;
			}

			const assistantMessage = buildChatMessage(
				'assistant',
				sequence,
				assistantResponse,
				currentSessionId
			);
			const chatTurn = createChatTurn(userMessage, assistantMessage);

			addChatTurn(chatTurn); // Update client state
			await storeChatTurn(chatTurn); // Store remotely (triggers server recap)

			setUserInput('');
		} catch (error: any) {
			const message = error.response?.data?.message || error.message || 'Failed to get response.';
			showError(`Error: ${message}`); // Set error state for UI
		} finally {
			setIsProcessing(false);
		}
	}, [
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
		const lastRequest = recentChatTurn.at(-1);
		// --- Pre-send Checks ---
		if (
			isProcessing ||
			recentChatTurn.length === 0 ||
			!lastRequest ||
			!currentSessionId ||
			isLoadingCredentials ||
			credentialError ||
			!credential ||
			Object.keys(credential).length === 0 ||
			!aiModelInfo
		) {
			showError('Cannot regenerate now.');
			return;
		}
		// --- End Checks ---

		setIsProcessing(true);
		const turnToRegen = recentChatTurn[recentChatTurn.length - 1];
		const sequence = turnToRegen.sequence;

		try {
			// Call Backend for New Response
			const response = await genResponseFromLlm('user', aiModelInfo);
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
		getResponseFromLlm,
		addChatTurn,
		storeChatTurn,
	]);

	const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

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
					onKeyPress={handleKeyPress}
					multiline
					maxRows={5}
					disabled={isProcessing || isLoadingCredentials}
					error={!!errorState || !!credentialError}
					helperText={errorState || credentialError?.message || ' '}
				/>
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
