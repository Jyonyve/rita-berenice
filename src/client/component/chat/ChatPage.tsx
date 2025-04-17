import React, { useState, useEffect, useCallback, useRef, FC, ChangeEvent } from 'react';
import { useChatServer, useChatClient, useAiModel, useCredential } from '@client/hook/index.ts';
import { ChatTurn, TempChatTurn } from '@shared/domain/index.ts';
import { buildChatMessage, parseEntriesToText } from '#root/src/shared/util/index.ts';

// Import the new components
import { CharacterPortrait } from '../character/index.ts';
import { ChatLog } from './ChatLog.tsx';
import { UserInput } from './UserInput.tsx';

// MUI Components
import { Grid, Box } from '@mui/material'; // Correct imports

// Placeholder data for portrait
const defaultPortraitImage =
	'https://images.unsplash.com/photo-1549068106-b79f918c62d8?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8M3x8aHVtYW4lMjBmYWNlfGVufDB8fDB8fA%3D%3D&w=1000&q=80';

export const ChatPage: FC<{ sessionId: string }> = ({ sessionId }) => {
	// --- STATE ---
	const [userInput, setUserInput] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [errorState, setErrorState] = useState<string | undefined>();
	const chatLogRef = useRef<HTMLDivElement>(null);

	// --- HOOKS ---
	const {
		chatTurns,
		tempChatTurn,
		isLoadingHistory,
		clientError,
		hasMoreHistory,
		setInitialData,
		addOlderChatTurns,
		addChatTurn,
		changeTempChatTurn,
		setIsLoadingHistory,
		setClientError,
		setHasMoreHistory,
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
	const { credential, isLoadingCredential, credentialError } = useCredential(); // Renamed isLoading

	// --- EFFECTS ---

	// Initial Load
	useEffect(() => {
		const loadInitialChatTurn = async () => {
			setIsLoadingHistory(true);
			try {
				const [fixed, temp] = await Promise.all([
					getRecentChatTurns(sessionId, 10),
					getTempChatTurn(sessionId),
				]);
				setInitialData(fixed, temp ?? undefined);
				setHasMoreHistory(fixed.length === 10);
			} catch (err: any) {
				setClientError('Failed to load initial chat history.');
				console.error('Initial Load Error:', err);
			} finally {
				setIsLoadingHistory(false);
			}
		};
		loadInitialChatTurn();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sessionId]); // Keep dependencies minimal

	// Auto-scroll to bottom
	useEffect(() => {
		if (chatLogRef.current) {
			setTimeout(() => {
				if (chatLogRef.current) chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
			}, 100);
		}
	}, [chatTurns, tempChatTurn]); // Trigger on new turns

	// --- CALLBACKS / HANDLERS ---

	// Send Message (includes auto-fix)
	const handleSendMessage = useCallback(async () => {
		setErrorState(undefined);
		if (
			!userInput.trim() ||
			isProcessing ||
			isLoadingCredential ||
			credentialError ||
			!credential ||
			!aiModelInfo
		) {
			setErrorState('Cannot send message. Check input, credentials, and model selection.');
			return;
		}
		setIsProcessing(true);
		try {
			const currentSequence = getNextSequence();
			if (tempChatTurn) {
				try {
					const sequenceToFix = currentSequence - 1;
					if (
						sequenceToFix >= 0 &&
						tempChatTurn.chatTurnSets[0]?.request &&
						tempChatTurn.chatTurnSets[0]?.response
					) {
						const { request, response } = tempChatTurn.chatTurnSets[0];
						const fixedTurn: ChatTurn = { sessionId, sequence: sequenceToFix, request, response };
						addChatTurn(fixedTurn);
						await storeChatTurn(fixedTurn); // Pass the whole turn
						await removeTempChatTurn(sessionId);
					} else {
						console.warn('Attempted to fix incomplete or invalid sequence temp turn:', tempChatTurn);
						await removeTempChatTurn(sessionId);
					}
				} catch (fixErr: any) {
					console.error('Failed to automatically fix previous turn:', fixErr);
					setErrorState('Error saving previous turn. Please try sending again.');
					setIsProcessing(false);
					return;
				}
			}

			const userMsg = buildChatMessage('user', currentSequence, userInput, sessionId);
			const prompt = await buildUserPromptFromLog(sessionId, userInput);
			const { assistantResponse } = await genResponseFromLlm(sessionId, 'user', prompt, aiModelInfo);
			const aiMsg = buildChatMessage('assistant', currentSequence, assistantResponse, sessionId);

			const newTempChatTurn: TempChatTurn = {
				sessionId,
				sequence: currentSequence, // Sequence is part of messages now, not top-level on TempTurn
				chatTurnSets: [{ request: userMsg, response: aiMsg }],
			};
			changeTempChatTurn(newTempChatTurn);
			await saveTempChatTurn(newTempChatTurn);
			setUserInput('');
		} catch (sendErr: any) {
			console.error('Send Message Error:', sendErr);
			setErrorState(`Failed to send message: ${sendErr.message || 'Unknown error'}`);
			changeTempChatTurn(tempChatTurn); // Revert client state on failure
		} finally {
			setIsProcessing(false);
		}
	}, [
		userInput,
		isProcessing,
		isLoadingCredential,
		credentialError,
		credential,
		aiModelInfo,
		tempChatTurn,
		getNextSequence,
		sessionId,
		buildUserPromptFromLog,
		genResponseFromLlm,
		addChatTurn,
		storeChatTurn,
		removeTempChatTurn,
		changeTempChatTurn,
		saveTempChatTurn,
		buildChatMessage,
	]);

	// Regenerate Response
	const handleRegenerateResponse = useCallback(async () => {
		if (!tempChatTurn || !tempChatTurn.chatTurnSets[0]?.request || !aiModelInfo) {
			setErrorState('Cannot regenerate: Missing data or AI model info.');
			return;
		}
		setIsProcessing(true);
		setErrorState(undefined);
		try {
			const requestEntries = tempChatTurn.chatTurnSets[0].request.entries;
			const originalUserInput = parseEntriesToText(requestEntries);
			const prompt = await buildUserPromptFromLog(sessionId, originalUserInput);
			const { assistantResponse } = await genResponseFromLlm(sessionId, 'user', prompt, aiModelInfo);
			const sequence = tempChatTurn.sequence; // Use existing sequence
			const newAiMsg = buildChatMessage('assistant', sequence, assistantResponse, sessionId);

			const updatedTempChatTurn: TempChatTurn = {
				...tempChatTurn,
				chatTurnSets: [{ request: tempChatTurn.chatTurnSets[0].request, response: newAiMsg }],
			};
			changeTempChatTurn(updatedTempChatTurn);
			await saveTempChatTurn(updatedTempChatTurn);
		} catch (err: any) {
			console.error('Regenerate Error:', err);
			setErrorState(`Failed to regenerate response: ${err.message || 'Unknown error'}`);
		} finally {
			setIsProcessing(false);
		}
	}, [
		tempChatTurn,
		aiModelInfo,
		buildUserPromptFromLog,
		genResponseFromLlm,
		sessionId,
		changeTempChatTurn,
		saveTempChatTurn,
		buildChatMessage,
		parseEntriesToText,
	]);

	// Edit Turn (Placeholder)
	const handleEditTurn = useCallback(
		async (turn: ChatTurn) => {
			console.log('Edit turn requested:', turn.sequence, parseEntriesToText(turn.request.entries));
			alert(`Edit functionality for turn ${turn.sequence} not yet implemented.`);
		},
		[sessionId, parseEntriesToText]
	);

	// Load Older Messages
	const handleOlderMessages = useCallback(async () => {
		if (isLoadingHistory || !hasMoreHistory) return;
		setIsLoadingHistory(true);
		try {
			const oldestSeq = chatTurns.length > 0 ? chatTurns[0].sequence : undefined;
			if (oldestSeq === undefined || oldestSeq <= 0) {
				setHasMoreHistory(false);
				setIsLoadingHistory(false);
				return;
			}
			const older = await getLoadingChatTurns(sessionId, oldestSeq, 10);
			if (older.length === 0) {
				setHasMoreHistory(false);
			} else {
				addOlderChatTurns(older);
				// Keep hasMoreHistory true only if we received a full batch
				if (older.length < 10) setHasMoreHistory(false);
			}
		} catch (err: any) {
			console.error('Load Older Error:', err);
			setClientError('Failed to load older messages.');
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
		setClientError,
	]);

	// Scroll Handler
	const handleScroll = useCallback(() => {
		if (!chatLogRef.current) return;
		const { scrollTop } = chatLogRef.current;
		if (scrollTop < 50 && hasMoreHistory && !isLoadingHistory) {
			// Load when near the top
			handleOlderMessages();
		}
	}, [isLoadingHistory, hasMoreHistory, handleOlderMessages]); // Depends on other state/callbacks

	// User Input Change Handler
	const handleUserInput = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		setUserInput(e.target.value);
	};

	// Determine if input should be disabled
	const isInputDisabled =
		isProcessing || (!!tempChatTurn && !tempChatTurn.chatTurnSets[0]?.response);

	// Scroll Listener Setup
	useEffect(() => {
		const currentRef = chatLogRef.current;
		if (currentRef) {
			currentRef.addEventListener('scroll', handleScroll);
		}
		return () => {
			if (currentRef) {
				currentRef.removeEventListener('scroll', handleScroll);
			}
		};
	}, [handleScroll]); // Depends on handleScroll callback

	// --- RENDER ---
	return (
		<Grid container spacing={2} sx={{ height: 'calc(100vh - 100px)', p: 2 }}>
			{/* Portrait Section */}
			<Grid size={{ xs: 12, md: 3 }}>
				<CharacterPortrait imageUrl={defaultPortraitImage} />
			</Grid>

			{/* Chat Area Section */}
			<Grid size={{ xs: 12, md: 9 }}>
				<Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
					{/* Chat Log */}
					<ChatLog
						logRef={chatLogRef}
						chatTurns={chatTurns}
						tempChatTurn={tempChatTurn}
						isLoadingHistory={isLoadingHistory}
						isProcessing={isProcessing} // Pass down for TempTurnDisplay
						clientError={clientError}
						credentialError={credentialError}
						errorState={errorState}
						onEditTurn={handleEditTurn}
						onRegenerateResponse={handleRegenerateResponse}
					/>

					{/* User Input */}
					<UserInput
						value={userInput}
						isProcessing={isProcessing}
						isDisabled={isInputDisabled}
						isLoadingCredentials={isLoadingCredential}
						onChange={handleUserInput}
						onSend={handleSendMessage}
					/>
				</Box>
			</Grid>
		</Grid>
	);
};
