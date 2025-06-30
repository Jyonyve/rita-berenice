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
	parseEntriesToText,
	parseTextToEntries,
	ChatMessageSet,
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
	const { saveTempChatTurn } = useChatApi();
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
			const userInput = parseEntriesToText(
				tempChatTurn.chatTurnSets[currentTempSetNo].request.entries
			);
			const tempChatTurnCdo: TempChatTurnCdo = { sessionId, sequence, userInput };
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
