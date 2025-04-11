// src/client/components/ChatComp.tsx (Relevant sections)
import { useChatServer, useChatClient, useAiModel, useCredential } from '@client/hook/index.ts';
import { DEFAULT_RECAP_INTERVAL, DEFAULT_QUERY_LIMIT, ChatTurn } from '@shared/index.ts';
import { buildChatMessage, parseEntriesToText } from '#root/src/shared/util/index.ts';
import { CircularProgress, Divider } from '@mui/material';
import { Stack, Box } from '@mui/system';
import { useState, useEffect, useCallback } from 'react';

export const ChatComp: React.FC = () => {
	const [userInput, setUserInput] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);

	// === Hooks ===
	const {
		// Functions manage client-side state
		recentChatTurn,
		isLoading: isHistoryLoading,
		currentSessionId,
		createChatTurn,
		addChatTurn,
		getNextSequence,
		loadChatHistory,
	} = useChatClient();

	const {
		// Functions make API calls to server
		storeChatTurn,
		buildUserPromptFromLog,
		genResponseFromLlm, // <-- API call for response
	} = useChatServer(currentSessionId); // <-- Pass session ID

	const { aiModelInfo, summaryAiModelInfo } = useAiModel(); // <-- Model selection state
	const { credential, isLoading: isLoadingCredentials, error: credentialError } = useCredential(); // <-- Credential status

	useEffect(() => {
		if (currentSessionId) {
			loadChatHistory(currentSessionId); // Trigger init history load
		}
		setUserInput('');
	}, [currentSessionId]);

	// === Event Handlers ===
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setUserInput(e.target.value);

	const handleSendMessage = useCallback(async () => {
		// --- Pre-send Checks (Keep these) ---
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
			// Set appropriate errorState before returning...
			return;
		}
		// --- End Checks ---

		setIsProcessing(true);
		const sequence = getNextSequence(); // Get sequence number BEFORE API calls

		try {
			const userMessage = buildChatMessage('user', sequence, userInput, currentSessionId);
			const enhancedPrompt = await buildUserPromptFromLog(userInput);

			// === Call Backend for Response ===
			const response = await genResponseFromLlm('user', enhancedPrompt, aiModelInfo);
			const { assistantResponse } = response;
			// === End Backend Call ===

			const assistantMessage = buildChatMessage(
				'assistant',
				sequence,
				assistantResponse,
				currentSessionId
			);

			// === Update Client State ===
			const chatTurn = createChatTurn(userMessage, assistantMessage);
			addChatTurn(chatTurn); // <-- Update local state via hook function

			// === Store Remotely ===
			await storeChatTurn(chatTurn); // <-- Store via server hook function

			setUserInput('');
		} catch (error: any) {
			const message = error.response?.data?.message || error.message || 'Failed to get response.';
		} finally {
			setIsProcessing(false);
		}
	}, [
		userInput,
		currentSessionId,
		isProcessing,
		isLoadingCredentials,
		getNextSequence,
		buildUserPromptFromLog,
		genResponseFromLlm,
		createChatTurn,
		addChatTurn,
		storeChatTurn,
		aiModelInfo,
	]);

	const handleRegenerateResponse = useCallback(async () => {
		// --- Pre-send Checks (Keep similar checks) ---
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
			return;
		}
		// --- End Checks ---

		setIsProcessing(true);
		// Get the sequence number of the turn to regenerate
		const turnToRegen = recentChatTurn[recentChatTurn.length - 1];
		const sequence = turnToRegen.sequence;

		try {
			const previousUserInput = parseEntriesToText(turnToRegen.request.entries);
			const enhancedPrompt = await buildUserPromptFromLog(previousUserInput);

			// === Call Backend for New Response ===
			const response = await genResponseFromLlm('user', enhancedPrompt, aiModelInfo);
			const { assistantResponse: newResponse } = response;
			// === End Backend Call ===

			const newAssistantMessage = buildChatMessage(
				'assistant',
				sequence,
				newResponse,
				currentSessionId
			);

			// === Update Client State ===
			// Create the updated turn structure
			const updatedTurn: ChatTurn = { ...turnToRegen, response: [newAssistantMessage], isFixed: true };
			addChatTurn(updatedTurn); // <-- Update local state (relies on addChatTurn handling updates)

			// === Store Remotely ===
			await storeChatTurn(updatedTurn); // <-- Store updated turn via server hook function
		} catch (error: any) {
			const message =
				error.response?.data?.message || error.message || 'Failed to regenerate response.';
		} finally {
			setIsProcessing(false);
		}
	}, [
		// Dependencies
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
		storeChatTurn, // Need addChatTurn here too
	]);

	const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		/* ... */
	};

	// --- Render (Ensure uses recentChatTurn from useChatClient) ---
	return (
		<Stack spacing={2} sx={{ p: 2, height: '100%', boxSizing: 'border-box' }}>
			{/* ... Typography, Divider ... */}
			<Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2 }}>
				{isHistoryLoading && <CircularProgress /> /* Show loading for history */}
				{recentChatTurn.map(
					(
						turn,
						turnIndex // <-- Renders state from useChatClient
					) => (
						<></>
					)
				)}
				{/* ... isProcessing, errorState, credential status ... */}
			</Box>
			<Divider />
			<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 'auto', pt: 2 }}>
				{/* ... TextField, Buttons with correct disabled states ... */}
			</Box>
		</Stack>
	);
};
