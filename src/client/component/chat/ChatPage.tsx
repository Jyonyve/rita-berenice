import React, { useState, useEffect, useCallback, ChangeEvent, JSX } from 'react';

// Import the new components
import { CharacterPortrait } from '../character/index.ts';
import { ChatLog } from './ChatLog.tsx';
import { UserInput } from './UserInput.tsx';

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
	CharacterInfo,
	ProfileInfo,
	DEFAULT_EMOTION,
	TempChatTurnCdo,
} from '@shared/index.ts';
import { useCharacterState, useChatState } from '../../hook/state/index.ts';
import {
	useCharacterApi,
	useChatApi,
	useOrchestrationApi,
	useProfileApi,
} from '../../hook/api/index.ts';
import { useAiModel, useCredential } from '../../hook/index.ts';
import { buildProfileId } from '#root/src/server/index.ts';

export const ChatPage = () => {
	// init
	const { sessionId } = useParams();
	const navigate = useNavigate();
	if (!sessionId) return;

	// const
	const { characterId } = parseSessionId(sessionId);
	// api hooks
	const { getCharacter } = useCharacterApi();
	const { getProfileBySessionId } = useProfileApi();
	const { storeChatTurn, saveTempChatTurn } = useChatApi();
	const { handleChatRequest } = useOrchestrationApi();

	const [character, profile] = await Promise.all([
		getCharacter(characterId),
		getProfileBySessionId(sessionId),
	]);

	const characterInfo = getCharacter(characterId).then((info) => info?.characterInfo);
	const profileInfo = getProfileBySessionId(sessionId).then((info) => info?.profileInfo);

	// client hooks
	const { portraitMap, getImageNumberForEmotion } = useCharacterState(characterId);
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

	const { aiModelInfo } = useAiModel();
	const { credential, isLoadingCredential, credentialError } = useCredential();

	// --- STATE ---

	const [currentTempSetNo, setCurrentTempSetNo] = useState(0);
	const [userInput, setUserInput] = useState('');
	const [userEditInput, setUserEditInput] = useState('');
	const [imageUrl, setImageUrl] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [pageError, setPageError] = useState<string>();

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
		setPageError(undefined);
		setIsProcessing(true);
		try {
			if (!tempChatTurn) return;
			if (!characterInfo || !profileInfo) return;

			const newTempSequence = getNextSequence();

			//user message
			const userMsg = buildChatMessage(
				'user',
				newTempSequence,
				profileInfo.showName,
				userInput.trim(),
				sessionId
			);
			//character
			const tempTurnCdo: TempChatTurnCdo = { sessionId, sequence: newTempSequence, userInput };
			const { stringifyResponse } = await handleChatRequest(
				tempTurnCdo,
				characterInfo,
				profileInfo,
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

	// --- Initial Data Load ---
	useEffect(() => {
		if (!sessionId) {
			navigate('/not-found-sessionId', { replace: true });
			return;
		}
		_initializeParticipants();
		// Pass the fetcher to initializeSession
		initializeSession(getLoadingChatTurns, DEFAULT_LOADING_BATCH_TURN_COUNT);

		return () => {};
	}, [sessionId, navigate, _initializeParticipants, initializeSession, getLoadingChatTurns]);

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
