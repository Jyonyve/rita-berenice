import { ChangeEvent, FC, useCallback, useEffect, useState } from 'react';

// Import the new components
import { ChatLog } from './ChatLog.jsx';
import { UserInput } from './UserInput.jsx';

// MUI Components
import { DEFAULT_EMOTION } from '#shared/config/emotionWordsMapper.js';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { ChatTurnCdo, TempChatTurn, TempChatTurnCdo } from '#shared/domain/chat/ChatInterfaces.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { parseEntriesToText, parseTextToEntries } from '#shared/util/chatParseUtils.js';
import { Box, Grid, Typography } from '@mui/material';
import { useOrchestrationApi, useTempChatApi } from '../../hook/api/index.js';
import { useChatState } from '../../hook/state/useChatState.js';
import { useAiModel } from '../../hook/useAiModel.js';
import { GlassPaper, GlassPortrait } from '../../layout/glass/index.js';
import { containerSpacing } from '../../style/index.js';
import { getImageForEmotion } from '../../util/portraitUtils.js';

export const ChatPage: FC<{
	characterInfo: CharacterInfo;
	profileInfo: ProfileInfo;
	sessionId: string;
	userId: string;
}> = ({ characterInfo, profileInfo, sessionId, userId }) => {
	const { receiveBotResponse, finalizeChatTurn } = useOrchestrationApi();
	const { saveTempChatTurn } = useTempChatApi();

	// --- HOOKS ---
	const {
		chatTurns,
		tempChatTurn,
		isLoadingHistory,
		clientError,
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

	// --- HANDLERS ---
	const handleCharacterImage = useCallback(
		(emotion: string) => {
			const newImageUrl = getImageForEmotion(characterInfo.characterId, emotion);
			if (newImageUrl) {
				setImageUrl(newImageUrl);
			}
		},
		[characterInfo.characterId]
	);
	useEffect(() => {
		// Initialize the character image when the component mounts
		let emotion: string = DEFAULT_EMOTION;

		if (tempChatTurn) {
			emotion = tempChatTurn.chatTurnSets[currentTempSetNo]?.response?.emotion || DEFAULT_EMOTION;
		} else if (chatTurns.length > 0) {
			emotion = chatTurns[chatTurns.length - 1].response?.emotion || DEFAULT_EMOTION;
		}

		handleCharacterImage(emotion);
	}, [chatTurns, tempChatTurn, currentTempSetNo, handleCharacterImage]);

	// The `loadOlderMessages` and `hasMoreHistory` props were removed from useChatState,
	// so the scroll handler is no longer needed.
	// const handleTriggerLoadOlder = ... (REMOVED)

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
				handleCharacterImage(emotion);
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
		handleCharacterImage,
		getRecentTurnsForMemory,
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
				handleCharacterImage(emotion);
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
		handleCharacterImage,
		getRecentTurnsForMemory,
		currentTempSetNo,
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

		const newChatTurnSets = tempChatTurn.chatTurnSets.map((set, index) =>
			index === currentTempSetNo ? updatedTurnSet : set
		);
		const updateTempTurn = { ...tempChatTurn, chatTurnSets: newChatTurnSets };

		await saveTempChatTurn.mutateAsync(updateTempTurn);
		changeTempChatTurn(updateTempTurn);
		setUserEditInput('');
		setBotEditInput('');
	};

	const handleUserInput = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		setUserInput(e.target.value);
	};

	// --- RENDER ---
	const isInputDisabled =
		isProcessing || (!!tempChatTurn && !tempChatTurn.chatTurnSets[0]?.response);

	return (
		<GlassPaper key="chat-page" className="paper">
			<Grid container spacing={containerSpacing}>
				{/* Portrait Section */}
				<Grid
					size={{ xs: 12, md: 4 }}
					sx={{
						position: { xs: 'static', md: 'sticky' },
						top: (theme) => theme.spacing(2),
						alignSelf: 'flex-start',
						height: {
							xs: 'auto',
							md: (theme) =>
								`calc(100vh - var(--header-height) - var(--footer-height) - ${theme.spacing(8)})`,
						},
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<Box sx={{ height: '100%', display: 'flex' }}>
						<GlassPortrait imageUrl={imageUrl} />
					</Box>
				</Grid>

				{/* Chat Area Section */}
				<Grid size={{ xs: 12, md: 8 }} sx={{ display: 'flex', flexDirection: 'column' }}>
					<Box sx={{ flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
						<ChatLog
							chatTurns={chatTurns}
							tempChatTurn={tempChatTurn}
							isLoadingChat={isLoadingHistory}
							isProcessing={isProcessing}
							clientError={clientError || pageError} // Combine client and page errors
							userEditInput={userEditInput}
							botEditInput={botEditInput}
							onEditTempTurnText={handleEditTempTurnText}
							onSaveTempTurnText={handleSaveTempTurnText}
							onRegenerateResponse={handleRegenerateResponse}
							currentTempSetNo={currentTempSetNo}
							changeTempSetNo={setCurrentTempSetNo}
							handleCharacterImage={handleCharacterImage}
						/>
					</Box>
					<Box sx={{ flexShrink: 0 }}>
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
