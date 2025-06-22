import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';

// Import the new components
import { CharacterPortrait } from '../character/index.ts';
import { ChatLog } from './ChatLog.tsx';
import { UserInput } from './UserInput.tsx';
import { useAiModel, useCredential } from '../../hook/index.ts';

// MUI Components
import { Grid, Box, Typography } from '@mui/material'; // Correct imports
import { useNavigate, useParams } from 'react-router-dom';
import {
	DEFAULT_LOADING_BATCH_TURN_COUNT,
	buildChatMessage,
	parseEntriesToText,
	parseSessionId,
	METADATA_TYPES,
	TempChatTurn,
	ChatTurn,
	ChatTurnCdo,
} from '@shared/index.ts';
import { useCharacterState, useChatState } from '../../hook/state/index.ts';
import { useChatApi } from '../../hook/api/index.ts';

export const ChatPage = () => {
	// init
	const { sessionId } = useParams();
	const navigate = useNavigate();

	if (!sessionId) return;
	// const
	const { charName, variant } = parseSessionId(sessionId);
	const characterId = `${charName}_${variant}`;
	const { portraitMap, getImageNumberForEmotion } = useCharacterState(characterId);

	// --- HOOKS ---
	const {
		chatTurns,
		tempChatTurn,
		isLoadingChat,
		clientError,
		hasMore,
		initializeSession,
		loadOlderMessages,
		addChatTurnIndexedDB,
		changeTempChatTurn,
		getCurrentSequence,
		getNextSequence,
	} = useChatState(sessionId);

	const { storeChatTurn, saveTempChatTurn } = useChatApi();

	const { aiModelInfo } = useAiModel();
	const { credential, isLoadingCredential, credentialError } = useCredential();

	// --- STATE ---
	const [currentTempSetNo, setCurrentTempSetNo] = useState(0);
	const [userInput, setUserInput] = useState('');
	const [userEditInput, setUserEditInput] = useState('');
	const [imageUrl, setImageUrl] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [pageError, setPageError] = useState<string>();

	// --- Initial Data Load ---
	useEffect(() => {
		if (!sessionId) {
			navigate('/not-found-sessionId', { replace: true });
			return;
		}
		// Pass the fetcher to initializeSession
		initializeSession(getLoadingChatTurns, DEFAULT_LOADING_BATCH_TURN_COUNT);

		return () => {};
	}, [sessionId, navigate, initializeSession, getLoadingChatTurns]);

	// --- CALLBACKS / HANDLERS ---
	const _validateDefaultCondition = () => {
		if (
			!userInput.trim() ||
			isProcessing ||
			isLoadingCredential ||
			credentialError ||
			!credential ||
			!aiModelInfo
		) {
			setPageError('Cannot send message. Check input, credentials, and model selection.');
		}
	};

	const _storeNewChatTurn = async (tempChatTurn: TempChatTurn) => {
		const newChatTurn: ChatTurnCdo = {
			sessionId,
			sequence: tempChatTurn.sequence,
			request: tempChatTurn.chatTurnSets[currentTempSetNo].request,
			response: tempChatTurn.chatTurnSets[currentTempSetNo].response,
		};
		try {
			//server
			const newChatTurnString = await storeChatTurn(newChatTurn);
			//client
			const updatedChatTurn = JSON.parse(newChatTurnString) as ChatTurn;
			await addChatTurnIndexedDB(updatedChatTurn);
		} catch (err: any) {
			console.error('Error storing new chat turn:', err);
			setPageError(`Failed to store chat turn: ${err.message || 'Unknown error'}`);
		}
	};

	// Load Character Image
	const _handleChatacterImage = (emotion: string) => {
		const imageNumber = getImageNumberForEmotion(emotion);
		const newImageUrl = portraitMap[imageNumber];
		newImageUrl && setImageUrl(newImageUrl);
	};

	// Scroll Handler
	const handleTriggerLoadOlder = useCallback(() => {
		if (sessionId && hasMore && !isLoadingChat) {
			// loadOlderMessages from useChatState expects the fetcher
			loadOlderMessages(getLoadingChatTurns, 10); // Pass batch size
		}
	}, [sessionId, loadOlderMessages, getLoadingChatTurns, hasMore, isLoadingChat]);

	// Send Message (includes auto-fix)
	const handleSendMessage = useCallback(async () => {
		_validateDefaultCondition();

		setPageError(undefined);
		setIsProcessing(true);
		try {
			if (!tempChatTurn) return;
			_storeNewChatTurn(tempChatTurn);

			const newTempSequence = getNextSequence();

			//user
			const userMsg = buildChatMessage('user', newTempSequence, 'the user', userInput, sessionId);
			//character
			const { stringifyResponse } = await genResponseFromLlm(
				sessionId,
				'user',
				userInput,
				aiModelInfo
			);
			const { response, emotion } = JSON.parse(stringifyResponse);
			// image
			_handleChatacterImage(emotion);
			// ai
			const aiMsg = buildChatMessage(
				'assistant',
				newTempSequence,
				charName,
				response,
				sessionId,
				emotion
			);
			const newTempChatTurn: TempChatTurn = {
				sessionId,
				sequence: newTempSequence,
				chatTurnSets: [{ request: userMsg, response: aiMsg }],
				type: METADATA_TYPES.TEMP,
			};
			changeTempChatTurn(newTempChatTurn);
			await saveTempChatTurn(newTempChatTurn);
			setUserInput('');
		} catch (sendErr: any) {
			console.error('Send Message Error:', sendErr);
			setPageError(`Failed to send message: ${sendErr.message || 'Unknown error'}`);
		} finally {
			setIsProcessing(false);
		}
	}, [
		tempChatTurn,
		getNextSequence,
		sessionId,
		genResponseFromLlm,
		addChatTurnIndexedDB,
		storeChatTurn,
		changeTempChatTurn,
		saveTempChatTurn,
		buildChatMessage,
	]);

	// Regenerate Response
	const handleRegenerateResponse = useCallback(async () => {
		if (!tempChatTurn || !tempChatTurn.chatTurnSets[0]?.request || !aiModelInfo) {
			setPageError('Cannot regenerate: Missing data or AI model info.');
			return;
		}
		setIsProcessing(true);
		setPageError(undefined);
		try {
			const sequence = tempChatTurn.sequence; // Use existing sequence

			const lastUserInput = parseEntriesToText(
				[...tempChatTurn.chatTurnSets].pop()?.request.entries ?? []
			);
			setUserEditInput(lastUserInput);
			//FIXME: make edit modal or textfield
			const newUserMsg = buildChatMessage('user', sequence, 'the user', userEditInput, sessionId);

			const { stringifyResponse } = await genResponseFromLlm(
				sessionId,
				'user',
				userEditInput,
				aiModelInfo
			);
			const { response, emotion } = JSON.parse(stringifyResponse);

			const newAiMsg = buildChatMessage('assistant', sequence, charName, response, sessionId, emotion);

			const updatedTempChatTurn: TempChatTurn = {
				...tempChatTurn,
				chatTurnSets: [{ request: newUserMsg, response: newAiMsg }],
			};
			changeTempChatTurn(updatedTempChatTurn);
			await saveTempChatTurn(updatedTempChatTurn);
		} catch (err: any) {
			console.error('Regenerate Error:', err);
			setPageError(`Failed to regenerate response: ${err.message || 'Unknown error'}`);
		} finally {
			setIsProcessing(false);
		}
	}, [
		tempChatTurn,
		aiModelInfo,
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

	// User Input Change Handler
	const handleUserInput = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		setUserInput(e.target.value);
	};

	// Determine if input should be disabled
	const isInputDisabled =
		isProcessing || (!!tempChatTurn && !tempChatTurn.chatTurnSets[0]?.response);

	// --- RENDER ---
	return (
		<Grid container spacing={2} sx={{ height: 'calc(100vh - 100px)', p: 2 }}>
			{/* Portrait Section */}
			<Grid size={{ xs: 12, md: 3 }}>
				<CharacterPortrait imageUrl={imageUrl} />
			</Grid>

			{/* Chat Area Section */}
			<Grid size={{ xs: 12, md: 9 }} sx={{ height: '100%' }}>
				<Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
					<Box
						id="chat-log-container" // Give it an ID if needed for styling/targeting
						sx={{
							flexGrow: 1,
							overflowY: 'auto', // Makes this Box scrollable
							display: 'flex',
							flexDirection: 'column-reverse', // Newest items at bottom
							height: 'calc(100% - 60px)', // Adjust based on UserInput height
						}}
					>
						{/* Chat Log */}
						<ChatLog
							chatTurns={chatTurns}
							tempChatTurn={tempChatTurn}
							hasMore={hasMore}
							isLoadingChat={isLoadingChat}
							isProcessing={isProcessing} // Pass down for TempTurnDisplay
							clientError={clientError}
							onEditTurn={handleEditTurn}
							onRegenerateResponse={handleRegenerateResponse}
							loadOlderMessages={handleTriggerLoadOlder}
							currentTempSetNo={currentTempSetNo}
							changeTempSetNo={(index: number) => setCurrentTempSetNo(index)}
						/>
					</Box>
					{pageError && (
						<Typography color="error" sx={{ p: 1 }}>
							{pageError}
						</Typography>
					)}
					{/* User Input */}
					<UserInput
						sessionId={sessionId}
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
