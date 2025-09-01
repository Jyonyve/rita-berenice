import { ChangeEvent, FC, useCallback, useEffect, useMemo, useState } from 'react';

// Import the new components
import { ChatLog } from './ChatLog.jsx';
import { UserInput } from './UserInput.jsx';

// MUI Components
import { DEFAULT_EMOTION } from '#shared/config/emotionConstants.js';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { ChatTurnCdo, TempChatTurn, TempChatTurnCdo } from '#shared/domain/chat/ChatInterfaces.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { Box, Grid, useMediaQuery, useTheme } from '@mui/material';
import { useOrchestrationApi, useTempChatApi, useSessionApi } from '../../hook/api/index.js';
import { useChatState } from '../../hook/state/useChatState.js';
import { GlassPaper, GlassPortrait } from '../../layout/glass/index.js';
import { containerSpacing } from '../../style/index.js';
import { useEmotionContext } from './ChatPageLoader.jsx';
import { getAiModelInfo, isValidAiModelInfo } from '#shared/util/aiModelUtils.js';
import {
	AiModelInfo,
	AllModelNames,
	DEFAULT_EXTRACTION_MODEL,
} from '#shared/domain/aimodel/AiInfoTypes.js';
import { useErrorDialog } from '../../util/styleUtils.jsx';
import { parseEntriesToText, parseTextToEntries } from '../../util/chatParseUtils.js';

export const ChatPage: FC<{
	characterInfo: CharacterInfo;
	profileInfo: ProfileInfo;
	sessionId: string;
	userId: string;
}> = ({ characterInfo, profileInfo, sessionId, userId }) => {
	const { receiveBotResponse, finalizeChatTurn } = useOrchestrationApi();
	const { saveTempChatTurn, getTempChatTurn } = useTempChatApi();
	const { updateSessionOnNewMessage } = useSessionApi();
	const theme = useTheme();
	const { showError } = useErrorDialog();

	// Get emotion context from Loader
	const { setCurrentEmotion, imageUrl } = useEmotionContext();

	// Responsive detection
	const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
	const isTabletPortrait = useMediaQuery(
		'(min-width: 768px) and (max-width: 1024px) and (orientation: portrait)'
	);
	const hasEnoughSpaceForDesktop = useMediaQuery('(min-width: 1200px)');
	const isWideTablet = useMediaQuery(
		'(min-width: 1024px) and (max-width: 1199px) and (orientation: landscape)'
	);

	const shouldUseMobileLayout =
		isSmallScreen || isTabletPortrait || (!hasEnoughSpaceForDesktop && !isWideTablet);

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

	const tempSequence = useMemo(() => {
		if (isLoadingHistory) {
			return -1; // Return an invalid sequence while loading to prevent firing
		}
		return chatTurns.length > 0 ? getNextSequence() : 0;
	}, [isLoadingHistory, chatTurns, getNextSequence]);

	const { data: tempTurnRes } = getTempChatTurn(sessionId, tempSequence, isLoadingHistory);

	useEffect(() => {
		if (tempTurnRes?.tempChatTurn) {
			changeTempChatTurn(tempTurnRes?.tempChatTurn);
			setCurrentTempSetNo(tempTurnRes?.tempChatTurn.chatTurnSets.length - 1);
		}
	}, [tempTurnRes]);

	// --- STATE (simplified - no image state) ---
	const [currentTempSetNo, setCurrentTempSetNo] = useState(0);
	const [userInput, setUserInput] = useState('');
	const [isProcessing, setIsProcessing] = useState(false);
	const [pageError, setPageError] = useState<string>();
	const [userEditInput, setUserEditInput] = useState('');
	const [botEditInput, setBotEditInput] = useState('');
	const [aiModelInfo, setAiModelInfo] = useState<AiModelInfo>(DEFAULT_EXTRACTION_MODEL);
	const [focusedTurnIndex, setFocusedTurnIndex] = useState(-1);
	const [isScene, setIsScene] = useState(false);

	const allTurns = tempChatTurn ? [...chatTurns, tempChatTurn] : chatTurns;

	// --- HANDLERS ---
	// Simplified: just update emotion in Loader context
	const handleCharacterImage = useCallback(
		(emotion: string) => {
			setCurrentEmotion(emotion);
		},
		[setCurrentEmotion]
	);

	const handleScene = useCallback(
		(event: ChangeEvent<HTMLInputElement>, checked: boolean) => {
			setIsScene(checked);
		},
		[setIsScene]
	);

	useEffect(() => {
		if (focusedTurnIndex < 0 || focusedTurnIndex >= allTurns.length) return;

		const focusedTurn = allTurns[focusedTurnIndex];
		if (!focusedTurn) {
			handleCharacterImage(DEFAULT_EMOTION);
		} else if (focusedTurn) {
			if ('setCount' in focusedTurn) {
				// It's a TempChatTurn
				const emotion =
					focusedTurn.chatTurnSets[currentTempSetNo]?.response?.emotion || DEFAULT_EMOTION;
				handleCharacterImage(emotion);
			} else {
				// It's a finalized ChatTurn
				const emotion = focusedTurn.response?.emotion || DEFAULT_EMOTION;
				handleCharacterImage(emotion);
			}
		}
	}, [focusedTurnIndex, currentTempSetNo, allTurns, handleCharacterImage]);

	const handleAiModel = useCallback(
		(modelName: AllModelNames) => {
			const newAiInfo = getAiModelInfo(modelName);

			if (!isValidAiModelInfo(newAiInfo)) {
				const errorMsg = `Invalid or unsupported AI model selected: ${modelName}`;
				showError(errorMsg);
				return;
			}

			console.log('Setting AI model to:', newAiInfo);
			setAiModelInfo(newAiInfo);
		},
		[showError]
	);

	const handleSendMessage = useCallback(async () => {
		setPageError(undefined);
		setIsProcessing(true);

		// This promise will finalize the *previous* temp turn
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

		// This promise generates the *new* temp turn
		const generatePromise = (async () => {
			if (!userInput.trim()) return null;
			const inputJsonString = JSON.stringify(parseTextToEntries(userInput));
			const recentChatTurnString = JSON.stringify(getRecentTurnsForMemory());
			const newTempSequence = getNextSequence();

			const tempChatTurnCdo: TempChatTurnCdo = {
				sessionId,
				sequence: newTempSequence,
				inputJsonString,
				userId,
			};
			return receiveBotResponse.mutateAsync({
				tempChatTurnCdo,
				characterInfo,
				profileInfo,
				aiModelInfo,
				recentChatTurnString,
				isScene,
			});
		})();

		try {
			// First, finalize the old turn
			const savedTurn = await finalizePromise;
			if (savedTurn) {
				addChatTurn(savedTurn);
			}

			// Then, generate and process the new turn
			const newTempTurnResult = await generatePromise;
			if (newTempTurnResult) {
				changeTempChatTurn(newTempTurnResult);
				setFocusedTurnIndex(chatTurns.length); // The index of the new temp turn
				setUserInput('');
				updateSessionOnNewMessage({
					sessionId,
					latestCharMessage: parseEntriesToText(newTempTurnResult.chatTurnSets[0].response.entries),
				});
			}
		} catch (err: any) {
			console.error('Send Message Error:', err);
			setPageError(`An error occurred: ${err.clientMessage || err.message || 'Unknown error'}`);
		} finally {
			setIsProcessing(false);
		}
	}, [
		// Ensure all dependencies are correct
		userInput,
		sessionId,
		userId,
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
		getRecentTurnsForMemory,
		chatTurns.length, // Keep this dependency
	]);

	const handleRegenerateResponse = useCallback(async () => {
		if (!aiModelInfo) {
			setPageError('Cannot regenerate: Missing data or AI model info.');
			return;
		}
		if (!tempChatTurn || !tempChatTurn.chatTurnSets[0]?.request) {
			setPageError('Cannot regenerate: No curretn Temp chat turn.');
			return;
		}
		setIsProcessing(true);
		setPageError(undefined);
		try {
			const sequence = tempChatTurn.sequence;
			const userInput = JSON.stringify(tempChatTurn.chatTurnSets[currentTempSetNo].request.entries);
			const recentChatTurnString = JSON.stringify(getRecentTurnsForMemory());
			const tempChatTurnCdo: TempChatTurnCdo = {
				sessionId,
				sequence,
				inputJsonString: userInput,
				userId,
			};
			const result: TempChatTurn = await receiveBotResponse.mutateAsync({
				tempChatTurnCdo,
				characterInfo,
				profileInfo,
				aiModelInfo,
				recentChatTurnString,
				isScene,
			});

			if (result) {
				const newSetIndex = result.chatTurnSets.length - 1;
				changeTempChatTurn(result);
				setCurrentTempSetNo(newSetIndex);
				setFocusedTurnIndex(chatTurns.length);
				updateSessionOnNewMessage({
					sessionId,
					latestCharMessage: JSON.stringify(result.chatTurnSets[newSetIndex].response.entries),
				});
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
		getRecentTurnsForMemory,
		currentTempSetNo,
		chatTurns.length,
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

		await saveTempChatTurn(updateTempTurn);
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

	// --- SHARED CHAT LOG PROPS ---
	const chatLogProps = {
		allTurns,
		isLoadingChat: isLoadingHistory,
		isProcessing,
		clientError: clientError || pageError,
		userEditInput,
		botEditInput,
		onEditTempTurnText: handleEditTempTurnText,
		onSaveTempTurnText: handleSaveTempTurnText,
		onRegenerateResponse: handleRegenerateResponse,
		shouldUseMobileLayout,
		focusedTurnIndex, // Pass down the state
		onFocusTurn: setFocusedTurnIndex, // Pass down the setter
		currentTempSetNo,
		changeTempSetNo: setCurrentTempSetNo,
	};

	const userInputProps = {
		sessionId,
		value: userInput,
		isProcessing,
		isDisabled: isInputDisabled,
		onChange: handleUserInput,
		onSend: handleSendMessage,
		modelName: aiModelInfo.model,
		onAiModel: handleAiModel,
		isScene,
		onScene: handleScene,
	};

	// --- RENDER ---
	return (
		<>
			{shouldUseMobileLayout ? (
				<>
					{/* Mobile Background */}
					<Box
						sx={{
							position: 'absolute',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							backgroundImage: imageUrl ? `url(${imageUrl})` : 'none',
							backgroundSize: 'cover',
							backgroundPosition: 'center',
							backgroundRepeat: 'no-repeat',
							backgroundAttachment: 'fixed',
							zIndex: 1,
							transition: 'background-image 0.3s ease-in-out',
						}}
					/>

					{/* Mobile Overlay */}
					<Box
						sx={{
							position: 'absolute',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							backgroundColor: 'rgba(0, 0, 0, 0.6)',
							backdropFilter: 'blur(2px)',
							zIndex: 2,
						}}
					/>

					{/* Mobile Content */}
					<Box
						sx={{
							display: 'flex',
							flexDirection: 'column',
							height: '100%',
							position: 'relative',
							zIndex: 10,
							// paddingTop: 'env(safe-area-inset-top)',
							// paddingBottom: 'env(safe-area-inset-bottom)',
						}}
					>
						{/* Mobile Chat */}
						<Box
							sx={{
								flexGrow: 1,
								overflow: 'hidden',
								backdropFilter: 'blur(2px)',
								WebkitBackdropFilter: 'blur(2px)',
								WebkitOverflowScrolling: 'touch',
								overscrollBehavior: 'contain',
							}}
						>
							<ChatLog {...chatLogProps} />
						</Box>

						{/* Mobile Input */}
						<Box
							sx={{
								flexShrink: 0,
								backdropFilter: 'blur(10px)',
								WebkitBackdropFilter: 'blur(10px)',
								'& input': { fontSize: '16px' }, // avoid iOS zoom
							}}
						>
							<UserInput {...userInputProps} />
						</Box>
					</Box>
				</>
			) : (
				// Desktop Layout - Only when there's enough space
				<GlassPaper
					key="chat-page"
					className="paper"
					sx={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column' }}
				>
					<Grid
						container
						spacing={containerSpacing}
						sx={{
							height: '100%',
							minHeight: 0,
							flex: 1,
							// FIXED: Let content flow naturally within the padded container
							width: '100%',
							margin: 0,
						}}
					>
						{/* Portrait Section - Properly contained */}
						<Grid
							size={{
								md: 4,
								lg: 3, // Smaller on very wide screens
								xl: 2.5,
							}}
							sx={{
								position: 'sticky',
								top: theme.spacing(2),
								alignSelf: 'flex-start',
								height: `calc(100vh - var(--header-height) - var(--footer-height) - ${theme.spacing(12)})`, // Account for GlassPaper padding
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								// FIXED: Natural sizing within grid constraints
								minWidth: 0, // Allow grid to control width
							}}
						>
							<Box
								sx={{
									height: '100%',
									width: '100%',
									display: 'flex',
									justifyContent: 'center',
									alignItems: 'center',
								}}
							>
								<GlassPortrait imageUrl={imageUrl} />
							</Box>
						</Grid>

						{/* Chat Area Section - Takes remaining space */}
						<Grid
							size={{ md: 8, lg: 9, xl: 9.5 }}
							sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 }}
						>
							<Box
								sx={{
									flexGrow: 1,
									overflow: 'hidden',
									position: 'relative',
									width: '100%',
									minHeight: 0,
									minWidth: 0,
								}}
							>
								<ChatLog {...chatLogProps} />
							</Box>
							<Box sx={{ flexShrink: 0, width: '100%', minWidth: 0 }}>
								<UserInput {...userInputProps} />
							</Box>
						</Grid>
					</Grid>
				</GlassPaper>
			)}
		</>
	);
};
