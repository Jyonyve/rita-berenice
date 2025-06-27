// src/client/component/page/ChatPage.tsx

import React, { useState, useEffect, useCallback, ChangeEvent, JSX } from 'react';

// Import the new components
import { CharacterPortrait } from '../../index.ts';
import { ChatLog } from './ChatLog.tsx';
import { UserInput } from './UserInput.tsx';

// MUI Components
import { Grid, Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
	DEFAULT_LOADING_BATCH_TURN_COUNT,
	METADATA_TYPES,
	TempChatTurn,
	ChatTurn,
	CharacterInfo,
	ProfileInfo,
	DEFAULT_EMOTION,
	TempChatTurnCdo,
	ChatTurnCdo,
} from '@shared/index.ts';
import { useCharacterState, useChatState } from '../../hook/state/index.ts';
import { useChatApi, useOrchestrationApi } from '../../hook/api/index.ts';
import { useAiModel } from '../../hook/index.ts';

export const ChatPage = ({
	characterInfo,
	profileInfo,
	sessionId,
}: {
	characterInfo: CharacterInfo;
	profileInfo: ProfileInfo;
	sessionId: string;
}) => {
	const { receiveBotResponse, finalizeChatTurn } = useOrchestrationApi();
	const { portraitMap, getImageNumberForEmotion } = useCharacterState(characterInfo.characterId);
	const {
		chatTurns,
		tempChatTurn,
		isLoadingHistory,
		hasMoreHistory,
		clientError,
		loadOlderMessages,
		addChatTurn,
		changeTempChatTurn,
		getNextSequence,
	} = useChatState(sessionId);

	const { aiModelInfo } = useAiModel();

	// --- STATE ---
	const [currentTempSetNo, setCurrentTempSetNo] = useState(0);
	const [userInput, setUserInput] = useState('');
	const [userEditInput, setUserEditInput] = useState('');
	const [imageUrl, setImageUrl] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [pageError, setPageError] = useState<string>();

	// Load Character Image
	const handleChatacterImage = (emotion: string) => {
		const imageNumber = getImageNumberForEmotion(emotion);
		const newImageUrl = portraitMap[imageNumber];
		newImageUrl && setImageUrl(newImageUrl);
	};

	// Scroll Handler
	const handleTriggerLoadOlder = useCallback(() => {
		if (sessionId && hasMoreHistory && !isLoadingHistory) {
			loadOlderMessages(DEFAULT_LOADING_BATCH_TURN_COUNT);
		}
	}, [sessionId, loadOlderMessages, hasMoreHistory, isLoadingHistory]);

	const handleSendMessage = useCallback(async () => {
		setPageError(undefined);
		setIsProcessing(true);

		const finalizePromise = (async () => {
			if (!tempChatTurn || tempChatTurn.chatTurnSets.length === 0) return null;
			const pickedTurnSet = tempChatTurn.chatTurnSets[currentTempSetNo];
			if (!pickedTurnSet) return null;

			const finalizedTurnCdo: ChatTurnCdo = {
				sessionId: tempChatTurn.sessionId,
				sequence: tempChatTurn.sequence,
				request: pickedTurnSet.request,
				response: pickedTurnSet.response,
			};
			return finalizeChatTurn.mutateAsync(finalizedTurnCdo);
		})();

		const generatePromise = (async () => {
			if (!userInput.trim()) return null;

			const newTempSequence = getNextSequence();
			const tempChatTurnCdo: TempChatTurnCdo = { sessionId, sequence: newTempSequence, userInput };

			return receiveBotResponse.mutateAsync({
				tempChatTurnCdo,
				characterInfo,
				profileInfo,
				aiModelInfo,
			});
		})();

		try {
			const newTempTurnResult = await generatePromise;

			if (newTempTurnResult) {
				changeTempChatTurn(newTempTurnResult);
				const emotion = newTempTurnResult.chatTurnSets[0]?.response?.emotion || DEFAULT_EMOTION;
				handleChatacterImage(emotion);
				setUserInput('');
			}

			const savedTurn = await finalizePromise;
			if (savedTurn) {
				addChatTurn(savedTurn);
			}
		} catch (err: any) {
			console.error('Send Message Error:', err);
			setPageError(`An error occurred: ${err.clientMessage || err.message || 'Unknown error'}`);
		} finally {
			setIsProcessing(false);
		}
	}, [
		userInput,
		sessionId,
		characterInfo,
		profileInfo,
		aiModelInfo,
		tempChatTurn,
		currentTempSetNo,
		finalizeChatTurn,
		receiveBotResponse,
		addChatTurn,
		changeTempChatTurn,
		getNextSequence,
		handleChatacterImage,
	]);

	const handleRegenerateResponse = useCallback(async () => {
		if (!tempChatTurn || !tempChatTurn.chatTurnSets[0]?.request || !aiModelInfo) {
			setPageError('Cannot regenerate: Missing data or AI model info.');
			return;
		}
		setIsProcessing(true);
		setPageError(undefined);
		try {
			const sequence = tempChatTurn.sequence;
			const tempChatTurnCdo: TempChatTurnCdo = { sessionId, sequence, userInput: userEditInput };
			const result: TempChatTurn = await receiveBotResponse.mutateAsync({
				tempChatTurnCdo,
				characterInfo,
				profileInfo,
				aiModelInfo,
			});

			if (result) {
				const emotion =
					result.chatTurnSets[result.chatTurnSets.length - 1].response.emotion || DEFAULT_EMOTION;
				handleChatacterImage(emotion);
				changeTempChatTurn(result);
			}
		} catch (err: any) {
			console.error('Regenerate Error:', err);
			setPageError(`Failed to regenerate response: ${err.message || 'Unknown error'}`);
		} finally {
			setIsProcessing(false);
		}
	}, [
		// [FIX] Corrected and completed the dependency array
		tempChatTurn,
		userEditInput,
		aiModelInfo,
		sessionId,
		receiveBotResponse,
		changeTempChatTurn,
		characterInfo,
		profileInfo,
		handleChatacterImage,
	]);

	const handleEditTurn = useCallback(
		(turn: ChatTurn) => {
			console.log('Edit turn requested:', turn.sequence);
			alert(`Edit functionality for turn ${turn.sequence} not yet implemented.`);
		},
		[] // No external dependencies needed for this version
	);

	const handleUserInput = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		setUserInput(e.target.value);
	};

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
						id="chat-log-container"
						sx={{
							flexGrow: 1,
							overflowY: 'auto',
							display: 'flex',
							flexDirection: 'column-reverse',
							height: 'calc(100% - 60px)',
						}}
					>
						<ChatLog
							chatTurns={chatTurns}
							tempChatTurn={tempChatTurn}
							hasMore={hasMoreHistory}
							isLoadingChat={isLoadingHistory}
							isProcessing={isProcessing}
							clientError={clientError}
							onEditTurn={handleEditTurn}
							onRegenerateResponse={handleRegenerateResponse}
							loadOlderMessages={handleTriggerLoadOlder}
							currentTempSetNo={currentTempSetNo}
							changeTempSetNo={setCurrentTempSetNo}
						/>
					</Box>
					{pageError && (
						<Typography color="error" sx={{ p: 1 }}>
							{pageError}
						</Typography>
					)}
					<UserInput
						sessionId={sessionId}
						value={userInput}
						isProcessing={isProcessing}
						isDisabled={isInputDisabled}
						isLoadingCredentials={false} // Assuming this is handled elsewhere
						onChange={handleUserInput}
						onSend={handleSendMessage}
					/>
				</Box>
			</Grid>
		</Grid>
	);
};
