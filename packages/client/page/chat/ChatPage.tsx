import { ChangeEvent, FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Import the new components
import { ChatLog } from './ChatLog.jsx';
import { UserInput } from './UserInput.jsx';

import {
	Box,
	Grid,
	useTheme,
	Dialog,
	DialogTitle,
	DialogContent,
	TextField,
	DialogActions,
	Typography,
} from '@mui/material';
import {
	useLlmApi,
	useOrchestrationApi,
	useTempChatApi,
	useSessionApi,
} from '../../hook/api/index.js';
import { useChatState } from '../../hook/state/useChatState.js';
import { GlassButton, GlassPaper, GlassPortrait } from '../../layout/component/glass/index.js';
import { containerSpacing } from '../../style/index.js';
import { chatSurfaceStyles } from '../../style/chatStyles.js';
import { mobileVisualViewportDialogSx } from '../../style/mobileDialogStyles.js';
import { useEmotionContext } from './ChatPageLoader.jsx';
import { getLangText, parseTextToEntries } from '../../util/index.js';
import { useResponsive } from '../../hook/useResponsive.js';
import { DEFAULT_CHAT_MODEL, DEFAULT_EMOTION, LANG_KEYS } from '@rita-berenice/shared/config';
import {
	CharacterInfo,
	ProfileInfo,
	SessionInfo,
	ChatTurnCdo,
	TempChatTurn,
	SessionContentPolicy,
} from '@rita-berenice/shared/domain';
import type { PortraitUrlMap } from '@rita-berenice/shared/config';
import { createBasicChatTurn } from '@rita-berenice/shared/util';
import { ChatGenerationStage } from '@rita-berenice/shared/api';
import {
	DEFAULT_CHAT_DISPLAY_MODE,
	getChatDisplayModeStorageKey,
	readChatDisplayMode,
	type ChatDisplayMode,
	writeChatDisplayMode,
} from './chatDisplayMode.js';
import {
	DEFAULT_CHAT_FONT_SIZE,
	DEFAULT_CHAT_FONT_WEIGHT,
	getChatFontSizeStorageKey,
	getChatFontWeightStorageKey,
	readChatFontSize,
	readChatFontWeight,
	type ChatFontSize,
	type ChatFontWeight,
	writeChatFontSize,
	writeChatFontWeight,
} from './chatFontSize.js';

export const ChatPage: FC<{
	characterInfo: CharacterInfo;
	profileInfo: ProfileInfo;
	sessionInfo: SessionInfo;
	userId: string;
	characterPortraitUrls?: PortraitUrlMap;
	characterAvatarUrls?: PortraitUrlMap;
	profileAvatarUrl?: string;
	onMobileInputFocusChange: (focused: boolean) => void;
}> = ({
	characterInfo,
	profileInfo,
	sessionInfo,
	userId,
	characterPortraitUrls,
	characterAvatarUrls,
	profileAvatarUrl,
	onMobileInputFocusChange,
}) => {
	const { receiveBotResponse, enqueueFinalization, waitForFinalizationJob } = useOrchestrationApi();
	const { saveTempChatTurn, getTempChatTurn } = useTempChatApi();
	const { updateSessionOnNewMessage, updateSessionUserNote, updateSessionContentPolicy } =
		useSessionApi();
	const { getModelCatalog } = useLlmApi();
	const { data: modelCatalog } = getModelCatalog();
	const sessionId = sessionInfo.sessionId;
	const displayModeStorageKey = useMemo(() => getChatDisplayModeStorageKey(userId), [userId]);
	const chatFontSizeStorageKey = useMemo(() => getChatFontSizeStorageKey(userId), [userId]);
	const chatFontWeightStorageKey = useMemo(() => getChatFontWeightStorageKey(userId), [userId]);

	// Get emotion context from Loader
	const { setCurrentEmotion, imageUrl } = useEmotionContext();
	const { shouldUseMobileLayout } = useResponsive();

	// --- HOOKS ---
	const {
		chatTurns,
		tempChatTurn,
		isLoadingHistory,
		clientError,
		addChatTurn,
		changeTempChatTurn,
		getNextSequence,
	} = useChatState(sessionId);

	const tempSequence = useMemo(() => {
		if (isLoadingHistory) {
			return -1; // Return an invalid sequence while loading to prevent firing
		}
		return chatTurns.length > 0 ? getNextSequence() : 0;
	}, [isLoadingHistory, chatTurns, getNextSequence]);

	const { data: tempTurnRes } = getTempChatTurn(sessionId, tempSequence);

	useEffect(() => {
		if (tempTurnRes?.tempChatTurn) {
			changeTempChatTurn(tempTurnRes?.tempChatTurn);
			setCurrentTempSetNo(tempTurnRes?.tempChatTurn.chatTurnSets.length - 1);
		}
	}, [tempTurnRes]);

	// --- STATE (simplified - no image state) ---
	const [currentTempSetNo, setCurrentTempSetNo] = useState(0);
	const [userInput, setUserInput] = useState('');
	const [userNote, setUserNote] = useState(sessionInfo.userNote);
	const [isProcessing, setIsProcessing] = useState(false);
	const [streamingText, setStreamingText] = useState('');
	const [streamingStage, setStreamingStage] = useState<ChatGenerationStage>();
	const streamAbortControllerRef = useRef<AbortController | undefined>(undefined);
	const finalizationControllersRef = useRef(new Set<AbortController>());
	const [pageError, setPageError] = useState<string>();
	const [userEditInput, setUserEditInput] = useState('');
	const [botEditInput, setBotEditInput] = useState('');
	const [modelName, setModelName] = useState(DEFAULT_CHAT_MODEL);
	const [displayMode, setDisplayMode] = useState<ChatDisplayMode>(DEFAULT_CHAT_DISPLAY_MODE);
	const [chatFontSize, setChatFontSize] = useState<ChatFontSize>(DEFAULT_CHAT_FONT_SIZE);
	const [chatFontWeight, setChatFontWeight] = useState<ChatFontWeight>(DEFAULT_CHAT_FONT_WEIGHT);
	const [contentPolicy, setContentPolicy] = useState<SessionContentPolicy>(
		sessionInfo.contentPolicy ?? 'general'
	);
	const [isContentPolicyUpdating, setIsContentPolicyUpdating] = useState(false);
	const [focusedTurnIndex, setFocusedTurnIndex] = useState(-1);

	// Modal state
	const [isUserNoteModalOpen, setIsUserNoteModalOpen] = useState(false);
	const [editingUserNote, setEditingUserNote] = useState(sessionInfo.userNote);

	useEffect(
		() => () => {
			streamAbortControllerRef.current?.abort();
			finalizationControllersRef.current.forEach((controller) => controller.abort());
			finalizationControllersRef.current.clear();
		},
		[]
	);

	useEffect(() => {
		setDisplayMode(
			readChatDisplayMode(
				typeof window === 'undefined' ? undefined : window.localStorage,
				displayModeStorageKey
			)
		);
	}, [displayModeStorageKey]);

	useEffect(() => {
		setChatFontSize(
			readChatFontSize(
				typeof window === 'undefined' ? undefined : window.localStorage,
				chatFontSizeStorageKey
			)
		);
	}, [chatFontSizeStorageKey]);

	useEffect(() => {
		setChatFontWeight(
			readChatFontWeight(
				typeof window === 'undefined' ? undefined : window.localStorage,
				chatFontWeightStorageKey
			)
		);
	}, [chatFontWeightStorageKey]);

	useEffect(() => {
		setContentPolicy(sessionInfo.contentPolicy ?? 'general');
	}, [sessionInfo.contentPolicy]);

	const allTurns = useMemo(
		() => (tempChatTurn ? [...chatTurns, tempChatTurn] : chatTurns),
		[chatTurns, tempChatTurn]
	);

	// --- HANDLERS ---

	// Add modal handlers
	const handleOpenUserNoteModal = useCallback(() => {
		setEditingUserNote(userNote || '');
		setIsUserNoteModalOpen(true);
	}, [userNote]);

	const handleCloseUserNoteModal = useCallback(() => {
		setIsUserNoteModalOpen(false);
	}, []);

	const handleSaveUserNote = useCallback(async () => {
		await updateSessionUserNote({ sessionId, userNote: editingUserNote });
		setUserNote(editingUserNote);
		setIsUserNoteModalOpen(false);
	}, [editingUserNote, updateSessionUserNote]);

	const handleContentPolicy = useCallback(
		async (nextPolicy: SessionContentPolicy) => {
			const previousPolicy = contentPolicy;
			setContentPolicy(nextPolicy);
			setIsContentPolicyUpdating(true);
			try {
				await updateSessionContentPolicy({ sessionId, contentPolicy: nextPolicy });
			} catch (error) {
				setContentPolicy(previousPolicy);
				setPageError(error instanceof Error ? error.message : 'Failed to update session policy.');
			} finally {
				setIsContentPolicyUpdating(false);
			}
		},
		[contentPolicy, sessionId, updateSessionContentPolicy]
	);

	// Simplified: just update emotion in Loader context
	const handleCharacterImage = useCallback(
		(emotion: string) => {
			setCurrentEmotion(emotion);
		},
		[setCurrentEmotion]
	);

	useEffect(() => {
		if (allTurns.length === 0) {
			handleCharacterImage(DEFAULT_EMOTION);
			return;
		}

		const targetTurnIndex =
			focusedTurnIndex >= 0 && focusedTurnIndex < allTurns.length
				? focusedTurnIndex
				: allTurns.length - 1;
		const focusedTurn = allTurns[targetTurnIndex];
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

	useEffect(() => {
		if (!modelCatalog?.models.length) return;
		if (!modelCatalog.models.some((model) => model.id === modelName)) {
			setModelName(modelCatalog.models[0].id);
		}
	}, [modelCatalog, modelName]);

	const handleAiModel = useCallback((selectedModelName: string) => {
		setModelName(selectedModelName);
	}, []);

	const handleDisplayMode = useCallback(
		(mode: ChatDisplayMode) => {
			setDisplayMode(mode);
			writeChatDisplayMode(
				typeof window === 'undefined' ? undefined : window.localStorage,
				displayModeStorageKey,
				mode
			);
		},
		[displayModeStorageKey]
	);

	const handleChatFontSize = useCallback(
		(fontSize: ChatFontSize) => {
			setChatFontSize(fontSize);
			writeChatFontSize(
				typeof window === 'undefined' ? undefined : window.localStorage,
				chatFontSizeStorageKey,
				fontSize
			);
		},
		[chatFontSizeStorageKey]
	);

	const handleChatFontWeight = useCallback(
		(fontWeight: ChatFontWeight) => {
			setChatFontWeight(fontWeight);
			writeChatFontWeight(
				typeof window === 'undefined' ? undefined : window.localStorage,
				chatFontWeightStorageKey,
				fontWeight
			);
		},
		[chatFontWeightStorageKey]
	);

	const finalizeTurnInBackground = useCallback(
		(chatTurnCdo: ChatTurnCdo) => {
			void addChatTurn(createBasicChatTurn(chatTurnCdo));

			void (async () => {
				const controller = new AbortController();
				finalizationControllersRef.current.add(controller);
				try {
					const { job, displayTurn } = await enqueueFinalization.mutateAsync({
						cdo: chatTurnCdo,
						signal: controller.signal,
					});
					await addChatTurn(displayTurn);
					if (job.status === 'completed') return;

					const finalizedTurn = await waitForFinalizationJob(
						chatTurnCdo.sessionId,
						chatTurnCdo.sequence,
						controller.signal
					);
					await addChatTurn(finalizedTurn);
				} catch (error) {
					if (
						controller.signal.aborted ||
						(error instanceof DOMException && error.name === 'AbortError')
					) {
						return;
					}
					console.error('Background chat finalization failed:', error);
					setPageError(
						'The message remains visible, but memory indexing failed. It will be retried when finalized again.'
					);
				} finally {
					finalizationControllersRef.current.delete(controller);
				}
			})();
		},
		[addChatTurn, enqueueFinalization, waitForFinalizationJob]
	);

	const handleSendMessage = useCallback(async () => {
		setPageError(undefined);
		setIsProcessing(true);
		setStreamingText('');
		setStreamingStage('preparing');
		streamAbortControllerRef.current?.abort();
		const streamController = new AbortController();
		streamAbortControllerRef.current = streamController;

		let newTempTurnResult = null;

		try {
			// 1. FIRST: Generate the new temp turn (AI response)
			if (userInput.trim()) {
				const newTempSequence = getNextSequence();
				newTempTurnResult = await receiveBotResponse.mutateAsync({
					request: {
						sessionId,
						sequence: newTempSequence,
						entries: parseTextToEntries(userInput),
						modelName,
					},
					onDelta: (text) => setStreamingText((current) => current + text),
					onStatus: setStreamingStage,
					signal: streamController.signal,
				});
			}

			// 2. SECOND: Only if AI response succeeded, finalize the previous temp turn
			if (newTempTurnResult) {
				// Finalize the old turn if it exists
				if (tempChatTurn && tempChatTurn.chatTurnSets.length > 0) {
					const pickedTurnSet = tempChatTurn.chatTurnSets[currentTempSetNo];
					if (pickedTurnSet) {
						const finalizedTurnCdo: ChatTurnCdo = {
							userId,
							sessionId: tempChatTurn.sessionId,
							sequence: tempChatTurn.sequence,
							request: pickedTurnSet.request,
							response: pickedTurnSet.response,
						};

						finalizeTurnInBackground(finalizedTurnCdo);
					}
				}

				// 3. THIRD: Update UI state with the new temp turn
				changeTempChatTurn(newTempTurnResult);
				setCurrentTempSetNo(0);
				handleCharacterImage(newTempTurnResult.chatTurnSets[0].response.emotion);
				setFocusedTurnIndex(chatTurns.length); // The index of the new temp turn
				setUserInput('');

				// Update session with latest character message
				updateSessionOnNewMessage({
					sessionId,
					latestCharMessage: JSON.stringify({
						latestCharMessage: newTempTurnResult.chatTurnSets[0].response.entries,
					}),
				});
			}
		} catch (err: any) {
			if (!streamController.signal.aborted) {
				console.error('Send Message Error:', err);
				setPageError(`An error occurred: ${err.clientMessage || err.message || 'Unknown error'}`);
			}
		} finally {
			setIsProcessing(false);
			setStreamingText('');
			setStreamingStage(undefined);
			if (streamAbortControllerRef.current === streamController) {
				streamAbortControllerRef.current = undefined;
			}
		}
	}, [
		// Ensure all dependencies are correct
		userInput,
		userId,
		sessionId,
		modelName,
		tempChatTurn,
		currentTempSetNo,
		finalizeTurnInBackground,
		handleCharacterImage,
		receiveBotResponse,
		addChatTurn,
		changeTempChatTurn,
		getNextSequence,
		updateSessionOnNewMessage,
		chatTurns.length, // Keep this dependency
	]);

	const handleCancelGeneration = useCallback(() => {
		streamAbortControllerRef.current?.abort();
	}, []);

	const handleRegenerateResponse = useCallback(async () => {
		if (!modelName) {
			setPageError('Cannot regenerate: Missing data or AI model info.');
			return;
		}
		if (!tempChatTurn || !tempChatTurn.chatTurnSets[0].request) {
			setPageError('Cannot regenerate: No current Temp chat turn.');
			return;
		}
		setIsProcessing(true);
		setPageError(undefined);
		setStreamingText('');
		setStreamingStage('preparing');
		streamAbortControllerRef.current?.abort();
		const streamController = new AbortController();
		streamAbortControllerRef.current = streamController;

		try {
			const sequence = tempChatTurn.sequence;
			const result: TempChatTurn = await receiveBotResponse.mutateAsync({
				request: {
					sessionId,
					sequence,
					entries: tempChatTurn.chatTurnSets[currentTempSetNo].request.entries,
					modelName,
				},
				onDelta: (text) => setStreamingText((current) => current + text),
				onStatus: setStreamingStage,
				signal: streamController.signal,
			});

			if (result) {
				const newSetIndex = result.chatTurnSets.length - 1;
				changeTempChatTurn(result);
				handleCharacterImage(result.chatTurnSets[newSetIndex].response.emotion);
				setCurrentTempSetNo(newSetIndex);
				setFocusedTurnIndex(chatTurns.length);

				updateSessionOnNewMessage({
					sessionId,
					latestCharMessage: JSON.stringify({
						latestCharMessage: result.chatTurnSets[newSetIndex].response.entries,
					}),
				});
			}
		} catch (err: any) {
			if (!streamController.signal.aborted) {
				console.error('Regenerate Error:', err);
				setPageError(`Failed to regenerate response: ${err.message || 'Unknown error'}`);
			}
		} finally {
			setIsProcessing(false);
			setStreamingText('');
			setStreamingStage(undefined);
			if (streamAbortControllerRef.current === streamController) {
				streamAbortControllerRef.current = undefined;
			}
		}
	}, [
		tempChatTurn,
		modelName,
		sessionId,
		receiveBotResponse,
		changeTempChatTurn,
		handleCharacterImage,
		updateSessionOnNewMessage,
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
		streamingText,
		streamingStage,
		displayMode,
		chatFontSize,
		chatFontWeight,
		characterPortraitUrls,
		characterAvatarUrls,
		profileAvatarUrl,
	};

	const userInputProps = {
		userId,
		value: userInput,
		isProcessing,
		isDisabled: isInputDisabled,
		onChange: handleUserInput,
		onSend: handleSendMessage,
		onCancel: handleCancelGeneration,
		modelName,
		models: modelCatalog?.models,
		onAiModel: handleAiModel,
		displayMode,
		onDisplayMode: handleDisplayMode,
		chatFontSize,
		onChatFontSize: handleChatFontSize,
		chatFontWeight,
		onChatFontWeight: handleChatFontWeight,
		contentPolicy,
		isContentPolicyUpdating,
		onContentPolicy: handleContentPolicy,
		onOpenUserNoteModal: handleOpenUserNoteModal,
		isMobileLayout: shouldUseMobileLayout,
		onFocusChange: onMobileInputFocusChange,
	};

	// --- RENDER ---
	return (
		<>
			{displayMode === 'conversation' ? (
				<Box
					sx={(theme) => ({
						position: 'relative',
						zIndex: 3,
						height: '100%',
						minHeight: 0,
						display: 'flex',
						flexDirection: 'column',
						backgroundColor:
							theme.palette.mode === 'light'
								? chatSurfaceStyles.light.conversationCanvas
								: theme.palette.background.default,
						overflow: 'hidden',
					})}
				>
					<Box sx={{ flexGrow: 1, minHeight: 0, overflow: 'hidden' }}>
						<ChatLog {...chatLogProps} />
					</Box>
					<Box sx={{ flexShrink: 0, minWidth: 0 }}>
						<UserInput {...userInputProps} />
					</Box>
				</Box>
			) : shouldUseMobileLayout ? (
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
						sx={(theme) => {
							const bookSurface = chatSurfaceStyles[theme.palette.mode];

							return {
								position: 'absolute',
								top: 0,
								left: 0,
								right: 0,
								bottom: 0,
								backgroundColor: bookSurface.bookOverlay,
								backdropFilter: bookSurface.bookBackdropFilter,
								WebkitBackdropFilter: bookSurface.bookBackdropFilter,
								zIndex: 2,
							};
						}}
					/>

					{/* Mobile Content */}
					<Box
						sx={{
							display: 'flex',
							flexDirection: 'column',
							height: '100%',
							minHeight: 0,
							position: 'relative',
							zIndex: 10,
						}}
					>
						{/* Mobile Chat */}
						<Box
							sx={{
								flexGrow: 1,
								minHeight: 0,
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
								paddingBottom: 'env(safe-area-inset-bottom)',
								backdropFilter: 'blur(10px)',
								WebkitBackdropFilter: 'blur(10px)',
								'& input, & textarea': { fontSize: '16px' }, // avoid iOS focus zoom
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
					sx={{
						position: 'relative',
						zIndex: 3,
						display: 'flex',
						flexDirection: 'column',
						height: '100%',
						minHeight: 0,
						overflow: 'hidden',
					}}
				>
					<Grid
						container
						spacing={containerSpacing}
						sx={{
							height: '100%',
							flex: 1,
							width: '100%',
							maxWidth: 1600,
							minHeight: 0,
							margin: 0,
							mx: 'auto',
							flexWrap: 'nowrap',
						}}
					>
						{/* Portrait Section - Properly contained */}
						<Grid
							size={{ md: 4, lg: 3, xl: 3 }}
							sx={(theme) => ({
								position: 'sticky',
								top: theme.spacing(2),
								alignSelf: 'flex-start',
								height: '100%',
								display: 'flex',
								alignItems: 'flex-start',
								justifyContent: 'center',
								minWidth: 0,
							})}
						>
							<Box
								sx={{
									height: '100%',
									width: '100%',
									maxWidth: 440,
									display: 'flex',
									justifyContent: 'center',
									alignItems: 'flex-start',
								}}
							>
								<GlassPortrait imageUrl={imageUrl} />
							</Box>
						</Grid>

						{/* Chat Area Section - Takes remaining space */}
						<Grid
							size={{ md: 8, lg: 9, xl: 9 }}
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
			{/* User Note Edit Modal */}
			<Dialog
				open={isUserNoteModalOpen}
				onClose={handleCloseUserNoteModal}
				maxWidth="md"
				fullWidth
				sx={mobileVisualViewportDialogSx}
			>
				<DialogTitle>{`${getLangText(LANG_KEYS.USER_NOTE)}`}</DialogTitle>
				<DialogContent>
					<TextField
						autoFocus
						margin="dense"
						fullWidth
						multiline
						rows={6}
						value={editingUserNote}
						sx={{ '& .MuiInputBase-input': { fontSize: { xs: '16px', md: 'inherit' } } }}
						onChange={(e) => setEditingUserNote(e.target.value)}
						placeholder={getLangText(LANG_KEYS.USER_NOTE_PLACEHOLDER)}
					/>
				</DialogContent>
				<DialogActions>
					<GlassButton onClick={handleCloseUserNoteModal} colorVariant="silver">
						{getLangText(LANG_KEYS.CANCEL)}
					</GlassButton>
					<GlassButton onClick={handleSaveUserNote} colorVariant="secondary">
						{getLangText(LANG_KEYS.SAVE)}
					</GlassButton>
				</DialogActions>
			</Dialog>
		</>
	);
};
