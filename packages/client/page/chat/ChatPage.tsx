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
	useChatApi,
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
import { getLangAlertText, getLangText, parseTextToEntries } from '../../util/index.js';
import { getCharacterImageArray } from '../../util/portraitUtils.js';
import { useResponsive } from '../../hook/useResponsive.js';
import { preloadImage, usePreloadImages } from '../../hook/useImagePreload.js';
import { DEFAULT_CHAT_MODEL, DEFAULT_EMOTION, LANG_KEYS } from '@rita-berenice/shared/config';
import {
	CharacterInfo,
	ProfileInfo,
	SessionInfo,
	ChatTurnCdo,
	TempChatTurn,
	SessionContentPolicy,
	API_KEY_ERROR_CODES,
	API_KEY_TYPE_LABELS,
	isApiKeyErrorCode,
	type ApiKeyType,
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

/**
 * Recognises the actionable API key failures the server marks, and renders them in the
 * viewer's language. Anything else stays on the generic error path.
 */
const readApiKeyFailure = (
	error: unknown
): { message: string; keyType?: ApiKeyType } | undefined => {
	const details = (error as { details?: { code?: unknown; keyType?: unknown } } | undefined)
		?.details;
	if (!isApiKeyErrorCode(details?.code)) return undefined;

	const keyType = details?.keyType as ApiKeyType | undefined;
	const providerLabel = keyType ? API_KEY_TYPE_LABELS[keyType] : '';
	const text = getLangAlertText(
		details.code === API_KEY_ERROR_CODES.missing
			? LANG_KEYS.API_KEY_MISSING
			: LANG_KEYS.API_KEY_REJECTED
	);

	return { message: providerLabel ? `${providerLabel} ${text}` : text, keyType };
};

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
	const { updateChatTurn, deleteChatTurnsFromSequence } = useChatApi();
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

	// A character caps out at 15 portraits, so warming the whole set up front is cheap and
	// means an emotion swap never waits on the network.
	const portraitUrls = useMemo(
		() => getCharacterImageArray(characterPortraitUrls),
		[characterPortraitUrls]
	);
	usePreloadImages(portraitUrls);

	// --- MOBILE BACKGROUND CROSSFADE ---
	// backgroundImage swaps are not animatable in CSS - they snap instantly, which reads as
	// choppy on mobile. Two alternating layers crossfade via opacity instead.
	const [bgSlots, setBgSlots] = useState<[string, string]>([imageUrl, '']);
	const [activeBgSlot, setActiveBgSlot] = useState<0 | 1>(0);

	useEffect(() => {
		if (!imageUrl || imageUrl === bgSlots[activeBgSlot]) return;
		let cancelled = false;
		let frame = 0;
		const nextSlot = activeBgSlot === 0 ? 1 : 0;

		// Wait for the image to be paintable before starting the fade. Without this the
		// crossfade can run against an undecoded layer and land on a blank frame, which
		// looks worse than the instant swap it replaced.
		void preloadImage(imageUrl).then(() => {
			if (cancelled) return;
			setBgSlots((prev) => {
				const next: [string, string] = [...prev];
				next[nextSlot] = imageUrl;
				return next;
			});
			// Let the new layer paint at opacity 0 first, otherwise there is no start value
			// for the transition to run from.
			frame = requestAnimationFrame(() => {
				if (!cancelled) setActiveBgSlot(nextSlot);
			});
		});

		return () => {
			cancelled = true;
			if (frame) cancelAnimationFrame(frame);
		};
	}, [imageUrl]);

	// --- HOOKS ---
	const {
		chatTurns,
		tempChatTurn,
		isLoadingHistory,
		clientError,
		addChatTurn,
		changeTempChatTurn,
		removeChatTurnsFromSequence,
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
	// Set when a send fails because the user's API key is missing or was refused, so the
	// input area can open the key dialog on the right provider instead of just showing text.
	const [apiKeyPrompt, setApiKeyPrompt] = useState<ApiKeyType>();
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

	const clearApiKeyPrompt = useCallback(() => setApiKeyPrompt(undefined), []);

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
				const apiKeyFailure = readApiKeyFailure(err);
				if (apiKeyFailure) {
					setPageError(apiKeyFailure.message);
					setApiKeyPrompt(apiKeyFailure.keyType);
				} else {
					setPageError(`An error occurred: ${err.clientMessage || err.message || 'Unknown error'}`);
				}
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

	// Both handlers below are memoized because they are part of ChatLog's props: a new function
	// identity on every render defeats ChatLog's memo, so the whole list would re-render (and
	// re-measure) whenever this page re-renders - which it does on every emotion change.
	const handleEditTempTurnText = useCallback((value: string, req: boolean) => {
		req ? setUserEditInput(value) : setBotEditInput(value);
	}, []);

	const handleSaveTempTurnText = useCallback(async () => {
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
	}, [
		tempChatTurn,
		currentTempSetNo,
		userEditInput,
		botEditInput,
		saveTempChatTurn,
		changeTempChatTurn,
	]);

	const handleUpdateFixedTurn = useCallback(
		async (sequence: number, userText: string, botText: string) => {
			const existingTurn = chatTurns.find((turn) => turn.sequence === sequence);
			if (!existingTurn) return;
			const request = { ...existingTurn.request, entries: parseTextToEntries(userText) };
			const response = { ...existingTurn.response, entries: parseTextToEntries(botText) };
			await updateChatTurn({ sessionId, sequence, request, response });
			await addChatTurn({ ...existingTurn, request, response, updatedAt: new Date().toISOString() });
		},
		[chatTurns, sessionId, updateChatTurn, addChatTurn]
	);

	const handleDeleteTurnsFromSequence = useCallback(
		async (sequence: number) => {
			// Deleting turn N also un-fixes turn N-1: N's own request was authored in
			// reaction to N-1's already-picked response, so keeping N-1 fixed while N is gone
			// makes little sense. This also means N-1's original temp candidates (never
			// deleted) resurface as the next temp turn after the new latest fixed turn, ready
			// to reroll/reselect through the existing temp-turn UI.
			const targetSequence = Math.max(sequence - 1, 0);
			await deleteChatTurnsFromSequence({ sessionId, sequence: targetSequence });
			await removeChatTurnsFromSequence(targetSequence);
			if (tempChatTurn && tempChatTurn.sequence >= targetSequence) {
				changeTempChatTurn(undefined);
			}
			setFocusedTurnIndex(-1);
		},
		[
			sessionId,
			deleteChatTurnsFromSequence,
			removeChatTurnsFromSequence,
			tempChatTurn,
			changeTempChatTurn,
		]
	);

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
		onUpdateFixedTurn: handleUpdateFixedTurn,
		onDeleteTurnsFromSequence: handleDeleteTurnsFromSequence,
		shouldUseMobileLayout,
		// focusedTurnIndex intentionally stays here and is not passed down - see ChatLogProps.
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
		localizeDirections: characterInfo.localizeDirections,
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
		apiKeyPrompt,
		onApiKeyPromptHandled: clearApiKeyPrompt,
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
					{/* Mobile Background (two layers crossfade via opacity) */}
					<Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
						{([0, 1] as const).map((slot) =>
							bgSlots[slot] ? (
								<Box
									key={slot}
									sx={{
										position: 'absolute',
										top: 0,
										left: 0,
										right: 0,
										bottom: 0,
										backgroundImage: `url(${bgSlots[slot]})`,
										backgroundSize: 'cover',
										backgroundPosition: 'center',
										backgroundRepeat: 'no-repeat',
										backgroundAttachment: 'fixed',
										opacity: activeBgSlot === slot ? 1 : 0,
										transition: 'opacity 0.4s ease-in-out',
									}}
								/>
							) : null
						)}
					</Box>

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
								WebkitOverflowScrolling: 'touch',
								overscrollBehavior: 'contain',
							}}
						>
							<ChatLog {...chatLogProps} />
						</Box>

						{/* Mobile Input */}
						<Box
							sx={(theme) => ({
								flexShrink: 0,
								paddingBottom: 'env(safe-area-inset-bottom)',
								backgroundColor: chatSurfaceStyles[theme.palette.mode].bookInputVeil,
								'& input, & textarea': { fontSize: '16px' }, // avoid iOS focus zoom
							})}
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
