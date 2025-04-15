import React, { useState, useEffect, useCallback } from 'react';
import { useChatServer, useChatClient, useAiModel, useCredential } from '@client/hook/index.ts';
import { ChatTurn, ChatMessage, TempChatTurn } from '@shared/index.ts';
import { buildChatMessage, parseEntriesToText } from '#root/src/shared/util/index.ts';
import { CircularProgress, Divider, TextField, Button, Typography, Paper } from '@mui/material';
import { Stack, Box } from '@mui/system';

export const ChatComp: React.FC<{ sessionId: string }> = ({ sessionId }) => {
	// UI state
	const [userInput, setUserInput] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [errorState, setErrorState] = useState<string>();

	// Hooks
	const {
		chatTurns,
		tempChatTurn,
		isLoading,
		isLoadingHistory,
		error,
		hasMoreHistory,
		setInitialData,
		addOlderChatTurns,
		addChatTurn,
		changeTempChatTurn,
		setIsLoading,
		setIsLoadingHistory,
		setError,
		setHasMoreHistory,
		clearChatState,
		getNextSequence,
	} = useChatClient();

	const {
		getRecentChatTurns,
		getLoadingChatTurns,
		storeChatTurn,
		getTempChatTurn,
		saveTempChatTurn,
		removeTempChatTurn,
		buildUserPromptFromLog,
		genResponseFromLlm,
	} = useChatServer(sessionId);

	const { aiModelInfo } = useAiModel();
	const { credential, isLoading: isLoadingCredentials, error: credentialError } = useCredential();

	// Initial load
	useEffect(() => {
		const loadInitial = async () => {
			setIsLoading(true);
			try {
				const [fixed, temp] = await Promise.all([
					getRecentChatTurns(sessionId, 10),
					getTempChatTurn(sessionId),
				]);
				// Convert null from server to undefined for client
				setInitialData(fixed, temp ?? undefined);
			} catch (err: any) {
				setError('Failed to load chat history.');
			} finally {
				setIsLoading(false);
			}
		};
		loadInitial();
		// eslint-disable-next-line
	}, [sessionId]);

	// Send message
	const handleSendMessage = useCallback(async () => {
		setErrorState(undefined);
		if (
			!userInput.trim() ||
			isProcessing ||
			isLoadingCredentials ||
			credentialError ||
			!credential ||
			!aiModelInfo
		) {
			setErrorState('Cannot send message. Check credentials and model.');
			return;
		}
		setIsProcessing(true);
		try {
			// 1. Build user message and temp turn
			const sequence = getNextSequence();
			const userMsg = buildChatMessage('user', sequence, userInput, sessionId);

			// 2. Build prompt and get AI response
			const prompt = await buildUserPromptFromLog(sessionId, userInput);
			const { assistantResponse } = await genResponseFromLlm(sessionId, 'user', prompt, aiModelInfo);
			const aiMsg = buildChatMessage('assistant', sequence, assistantResponse, sessionId);

			// 3. Update temp turn with response and save
			const tempChatTurn: TempChatTurn = {
				sessionId,
				chatTurnSets: [{ request: userMsg, response: aiMsg }],
			};
			changeTempChatTurn(tempChatTurn);
			await saveTempChatTurn(tempChatTurn);

			setUserInput('');
		} catch (err: any) {
			setErrorState('Failed to send message.');
		} finally {
			setIsProcessing(false);
		}
	}, [
		userInput,
		isProcessing,
		isLoadingCredentials,
		credentialError,
		credential,
		aiModelInfo,
		changeTempChatTurn,
		saveTempChatTurn,
		buildUserPromptFromLog,
		genResponseFromLlm,
		getNextSequence,
		sessionId,
	]);

	// Select response (fix turn)
	const handleSelectResponse = useCallback(async () => {
		if (!tempChatTurn) return;
		setIsProcessing(true);
		try {
			const { request, response } = tempChatTurn.chatTurnSets[0];
			const sequence = getNextSequence();
			const fixedTurn: ChatTurn = { sessionId, sequence, request, response };
			addChatTurn(fixedTurn);
			changeTempChatTurn(undefined);
			await storeChatTurn(sessionId, fixedTurn);
			await removeTempChatTurn(sessionId);
		} catch (err: any) {
			setErrorState('Failed to fix turn.');
		} finally {
			setIsProcessing(false);
		}
	}, [
		tempChatTurn,
		addChatTurn,
		changeTempChatTurn,
		storeChatTurn,
		removeTempChatTurn,
		getNextSequence,
		sessionId,
	]);

	// Load older turns
	const handleLoadOlder = useCallback(async () => {
		if (isLoadingHistory || !hasMoreHistory) return;
		setIsLoadingHistory(true);
		try {
			const beforeSeq = chatTurns[0]?.sequence;
			if (beforeSeq === undefined) return;
			const older = await getLoadingChatTurns(sessionId, beforeSeq, 10);
			addOlderChatTurns(older);
			if (older.length < 10) setHasMoreHistory(false);
		} catch (err: any) {
			setError('Failed to load older messages.');
		} finally {
			setIsLoadingHistory(false);
		}
	}, [
		isLoadingHistory,
		hasMoreHistory,
		chatTurns,
		getLoadingChatTurns,
		sessionId,
		addOlderChatTurns,
		setHasMoreHistory,
		setIsLoadingHistory,
		setError,
	]);

	// Render
	return (
		<Stack spacing={2} sx={{ padding: 2 }}>
			<Typography variant="h5">Chat Session: {sessionId}</Typography>
			<Paper elevation={3} sx={{ padding: 2, minHeight: 300 }}>
				{isLoading && <CircularProgress />}
				{chatTurns.map((turn) => (
					<div key={turn.sequence}>
						<b>User:</b> {parseEntriesToText(turn.request.entries)}
						<br />
						<b>Assistant:</b> {parseEntriesToText(turn.response.entries)}
						<Divider sx={{ my: 1 }} />
					</div>
				))}
				{tempChatTurn && (
					<div style={{ background: '#ffe' }}>
						<b>User:</b> {parseEntriesToText(tempChatTurn.chatTurnSets[0].request.entries)}
						<br />
						<b>Assistant:</b>{' '}
						{tempChatTurn.chatTurnSets[0].response ? (
							parseEntriesToText(tempChatTurn.chatTurnSets[0].response.entries)
						) : (
							<i>Waiting for response...</i>
						)}
						<Button
							onClick={handleSelectResponse}
							disabled={isProcessing || !tempChatTurn.chatTurnSets[0].response}
							sx={{ mt: 1 }}
						>
							Fix Turn
						</Button>
						<Divider sx={{ my: 1 }} />
					</div>
				)}
				{hasMoreHistory && (
					<Button onClick={handleLoadOlder} disabled={isLoadingHistory}>
						{isLoadingHistory ? 'Loading...' : 'Load Older'}
					</Button>
				)}
			</Paper>
			<Box>
				<TextField
					label="Your message"
					value={userInput}
					onChange={(e) => setUserInput(e.target.value)}
					fullWidth
					disabled={isProcessing || !!tempChatTurn}
					onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
				/>
				<Button
					variant="contained"
					onClick={handleSendMessage}
					disabled={isProcessing || !!tempChatTurn}
					sx={{ mt: 1 }}
				>
					Send
				</Button>
			</Box>
			{errorState && <Typography color="error">{errorState}</Typography>}
			{error && <Typography color="error">{error}</Typography>}
			{isLoadingCredentials && <Typography>Loading credentials...</Typography>}
			{credentialError && <Typography color="error">{credentialError.message}</Typography>}
		</Stack>
	);
};
