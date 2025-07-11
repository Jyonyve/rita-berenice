// src/client/component/page/ChatPage.tsx

import React, { useState, useEffect, useCallback, ChangeEvent, JSX, FC } from 'react';

// Import the new components

import { ChatLog } from './ChatLog.jsx';
import { UserInput } from './UserInput.jsx';
// MUI Components
import { Grid, Box, Typography, Paper } from '@mui/material';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { useOrchestrationApi } from '../../hook/api/useOrchestrationApi.js';
import { useCharacterState } from '../../hook/state/useCharacterState.js';
import { useChatApi } from '../../hook/api/useChatApi.js';
import { useChatState } from '../../hook/state/useChatState.js';
import { useAiModel } from '../../hook/useAiModel.js';
import { DEFAULT_LOADING_BATCH_TURN_COUNT } from '#shared/config/constants.js';
import { ChatTurnCdo, TempChatTurn, TempChatTurnCdo } from '#shared/domain/chat/ChatInterfaces.js';
import { DEFAULT_EMOTION } from '#shared/config/emotionWordsMapper.js';
import { parseEntriesToText, parseTextToEntries } from '#shared/util/chatParseUtils.js';

import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { useTempChatApi } from '../../hook/api/useTempChatApi.js';
import { GlassPaper, GlassPortrait } from '../../layout/glass/index.js';

export const ChatPage: FC<{
	characterInfo: CharacterInfo;
	profileInfo: ProfileInfo;
	sessionId: string;
	userId: string;
}> = ({ characterInfo, profileInfo, sessionId, userId }) => {
	const { receiveBotResponse, finalizeChatTurn } = useOrchestrationApi();
	const { saveTempChatTurn } = useTempChatApi();
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
		getRecentTurnsForMemory,
	} = useChatState(sessionId);

	const { aiModelInfo } = useAiModel();

	// --- STATE ---
	const [currentTempSetNo, setCurrentTempSetNo] = useState(0);
	const [userInput, setUserInput] = useState('');
	const [imageUrl, setImageUrl] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [pageError, setPageError] = useState<string>();
	const [userEditInput, setUserEditInput] = useState('');
	const [botEditInput, setBotEditInput] = useState('');

	// Load Character Image
	const handleChatacterImage = (emotion: string) => {
		const imageNumber = getImageNumberForEmotion(emotion);
		const newImageUrl = portraitMap[imageNumber];
		newImageUrl && setImageUrl(newImageUrl);
		console.log(newImageUrl);
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
				userId,
				sessionId: tempChatTurn.sessionId,
				sequence: tempChatTurn.sequence,
				request: pickedTurnSet.request,
				response: pickedTurnSet.response,
			};
			return finalizeChatTurn.mutateAsync(finalizedTurnCdo);
		})();

		const generatePromise = (async () => {
			if (!userInput.trim()) return null;
			const recentChatTurnString = JSON.stringify(getRecentTurnsForMemory());
			const newTempSequence = getNextSequence();
			const tempChatTurnCdo: TempChatTurnCdo = {
				sessionId,
				sequence: newTempSequence,
				userInput,
				userId,
			};

			return receiveBotResponse.mutateAsync({
				tempChatTurnCdo,
				characterInfo,
				profileInfo,
				aiModelInfo,
				recentChatTurnString,
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
			const userInput = parseEntriesToText(
				tempChatTurn.chatTurnSets[currentTempSetNo].request.entries
			);
			const recentChatTurnString = JSON.stringify(getRecentTurnsForMemory());
			const tempChatTurnCdo: TempChatTurnCdo = { sessionId, sequence, userInput, userId };
			const result: TempChatTurn = await receiveBotResponse.mutateAsync({
				tempChatTurnCdo,
				characterInfo,
				profileInfo,
				aiModelInfo,
				recentChatTurnString,
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
		tempChatTurn,
		aiModelInfo,
		sessionId,
		receiveBotResponse,
		changeTempChatTurn,
		characterInfo,
		profileInfo,
		handleChatacterImage,
	]);

	const handleEditTempTurnText = (value: string, req: boolean) => {
		req ? setUserEditInput(value) : setBotEditInput(value);
	};

	const handleSaveTempTurnText = async () => {
		if (!tempChatTurn) return;

		const currentTurnSet = tempChatTurn.chatTurnSets[currentTempSetNo];
		const updatedTurnSet = {
			...currentTurnSet,
			request: { ...currentTurnSet.request, entries: parseTextToEntries(userEditInput) },
			response: { ...currentTurnSet.response, entries: parseTextToEntries(botEditInput) },
		};

		const newChatTurnSets = tempChatTurn.chatTurnSets.map((set, index) => {
			if (index === currentTempSetNo) {
				return updatedTurnSet;
			}
			return set;
		});
		const updateTempTurn = { ...tempChatTurn, chatTurnSets: newChatTurnSets };

		await saveTempChatTurn.mutateAsync(updateTempTurn);
		changeTempChatTurn(updateTempTurn);
		setUserEditInput('');
		setBotEditInput('');
	};

	const handleUserInput = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		setUserInput(e.target.value);
	};

	const isInputDisabled =
		isProcessing || (!!tempChatTurn && !tempChatTurn.chatTurnSets[0]?.response);

	useEffect(() => {
		if (tempChatTurn) {
			const currentEmotion = tempChatTurn.chatTurnSets[currentTempSetNo]?.response?.emotion;
			handleChatacterImage(currentEmotion || DEFAULT_EMOTION);
		} else if (chatTurns && chatTurns.length > 0) {
			const lastTurn = chatTurns.slice(-1);

			if (lastTurn.length > 0 && lastTurn[0].response?.emotion) {
				handleChatacterImage(lastTurn[0].response.emotion);
			} else {
				handleChatacterImage(DEFAULT_EMOTION);
			}
		} else {
			handleChatacterImage(DEFAULT_EMOTION);
		}
	}, [tempChatTurn, chatTurns, currentTempSetNo]);

	// --- RENDER ---
	return (
		<GlassPaper className="paper" sx={{ display: 'flex', flexDirection: 'column' }}>
			<Grid container spacing={3}>
				{/* Portrait Section */}
				<Grid size={{ xs: 12, md: 5 }}>
					<GlassPortrait imageUrl={imageUrl} />
				</Grid>

				{/* Chat Area Section */}
				<Grid size={{ xs: 12, md: 7 }} sx={{ display: 'flex', flexDirection: 'column' }}>
					<Box sx={{ flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
						<ChatLog
							chatTurns={chatTurns}
							tempChatTurn={tempChatTurn}
							hasMore={hasMoreHistory}
							isLoadingChat={isLoadingHistory}
							isProcessing={isProcessing}
							clientError={clientError}
							userEditInput={userEditInput}
							botEditInput={botEditInput}
							onEditTempTurnText={handleEditTempTurnText}
							onSaveTempTurnText={handleSaveTempTurnText}
							onRegenerateResponse={handleRegenerateResponse}
							loadOlderMessages={handleTriggerLoadOlder}
							currentTempSetNo={currentTempSetNo}
							changeTempSetNo={setCurrentTempSetNo}
						/>
					</Box>
					<Box sx={{ flexShrink: 0, p: 1 }}>
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
							onChange={handleUserInput}
							onSend={handleSendMessage}
						/>
					</Box>
				</Grid>
			</Grid>
		</GlassPaper>
	);
};
