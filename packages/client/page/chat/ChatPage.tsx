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
} from '@mui/material';
import { useOrchestrationApi, useTempChatApi, useSessionApi } from '../../hook/api/index.js';
import { useChatState } from '../../hook/state/useChatState.js';
import { GlassButton, GlassPaper, GlassPortrait } from '../../layout/component/glass/index.js';
import { containerSpacing } from '../../style/index.js';
import { useEmotionContext } from './ChatPageLoader.jsx';
import { getLangText, parseTextToEntries, useErrorDialog } from '../../util/index.js';
import { useResponsive } from '../../hook/useResponsive.js';
import { DEFAULT_EMOTION, LANG_KEYS } from '@rita-berenice/shared/config';
import {
	CharacterInfo,
	ProfileInfo,
	SessionInfo,
	AiModelInfo,
	DEFAULT_EXTRACTION_MODEL,
	AllModelNames,
	ChatTurnCdo,
	TempChatTurn,
} from '@rita-berenice/shared/domain';
import {
	createBasicChatTurn,
	getAiModelInfo,
	isValidAiModelInfo,
} from '@rita-berenice/shared/util';
import { ChatGenerationStage } from '@rita-berenice/shared/api';

export const ChatPage: FC<{
	characterInfo: CharacterInfo;
	profileInfo: ProfileInfo;
	sessionInfo: SessionInfo;
	userId: string;
}> = ({ characterInfo, profileInfo, sessionInfo, userId }) => {
	const { receiveBotResponse, enqueueFinalization, waitForFinalizationJob } = useOrchestrationApi();
	const { saveTempChatTurn, getTempChatTurn } = useTempChatApi();
	const { updateSessionOnNewMessage, updateSessionUserNote } = useSessionApi();
	const { showError } = useErrorDialog();

	const sessionId = sessionInfo.sessionId;

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
	const [aiModelInfo, setAiModelInfo] = useState<AiModelInfo>(DEFAULT_EXTRACTION_MODEL);
	const [focusedTurnIndex, setFocusedTurnIndex] = useState(-1);
	const [isScene, setIsScene] = useState(false);

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

	const allTurns = tempChatTurn ? [...chatTurns, tempChatTurn] : chatTurns;

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
						modelName: aiModelInfo.model,
						isScene,
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
			console.error('Send Message Error:', err);
			setPageError(`An error occurred: ${err.clientMessage || err.message || 'Unknown error'}`);
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
		aiModelInfo,
		isScene,
		tempChatTurn,
		currentTempSetNo,
		finalizeTurnInBackground,
		receiveBotResponse,
		addChatTurn,
		changeTempChatTurn,
		getNextSequence,
		updateSessionOnNewMessage,
		chatTurns.length, // Keep this dependency
	]);

	const handleRegenerateResponse = useCallback(async () => {
		if (!aiModelInfo) {
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
					modelName: aiModelInfo.model,
					isScene,
				},
				onDelta: (text) => setStreamingText((current) => current + text),
				onStatus: setStreamingStage,
				signal: streamController.signal,
			});

			if (result) {
				const newSetIndex = result.chatTurnSets.length - 1;
				changeTempChatTurn(result);
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
			console.error('Regenerate Error:', err);
			setPageError(`Failed to regenerate response: ${err.message || 'Unknown error'}`);
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
		aiModelInfo,
		sessionId,
		isScene,
		receiveBotResponse,
		changeTempChatTurn,
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
	};

	const userInputProps = {
		sessionInfo,
		value: userInput,
		isProcessing,
		isDisabled: isInputDisabled,
		onChange: handleUserInput,
		onSend: handleSendMessage,
		modelName: aiModelInfo.model,
		onAiModel: handleAiModel,
		isScene,
		onScene: handleScene,
		onOpenUserNoteModal: handleOpenUserNoteModal,
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
								// lg: 3, xl: 2.5
							}}
							sx={(theme) => ({
								position: 'sticky',
								top: theme.spacing(2),
								alignSelf: 'flex-start',
								height: `calc(100vh - var(--header-height) - var(--footer-height) - ${theme.spacing(8)})`,
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
			{/* User Note Edit Modal */}
			<Dialog open={isUserNoteModalOpen} onClose={handleCloseUserNoteModal} maxWidth="md" fullWidth>
				<DialogTitle>{`${getLangText(LANG_KEYS.USER_NOTE)}`}</DialogTitle>
				<DialogContent>
					<TextField
						autoFocus
						margin="dense"
						fullWidth
						multiline
						rows={6}
						value={editingUserNote}
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
