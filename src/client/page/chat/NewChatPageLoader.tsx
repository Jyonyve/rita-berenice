// src/client/page/ChatPageLoader.tsx

import { DEFAULT_EMOTION } from '#shared/config/emotionWordsMapper.js';
import { ChatMessage, TempChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { buildMessageId } from '#shared/util/buildIdUtils.js';
import { parseTextToEntries } from '#shared/util/chatParseUtils.js';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
	useCharacterApi,
	useProfileApi,
	useSessionApi,
	useTempChatApi,
} from '../../hook/api/index.js';
import { useAuth } from '../../provider/AuthProvider.jsx';
import { routeConstants } from '../../routeConstants.js';

export function NewChatPageLoader() {
	const navigate = useNavigate();
	const { state } = useLocation();
	const { isSessionLoading, userId } = useAuth();
	const [error, setError] = useState<string | null>(null);

	// Ensure state exists before destructuring
	const characterId: string = state?.characterId || '';
	const profileId: string = state?.profileId || '';

	// --- API and State Hooks ---
	const {
		data: characterRes,
		isLoading: isLoadingCharacter,
		isError: isCharacterError,
	} = useCharacterApi().getCharacter(characterId);
	const { createSession } = useSessionApi();
	const { data: profileRes, isLoading: isProfileLoading } = useProfileApi().getProfile(profileId);
	const { saveTempChatTurn } = useTempChatApi();

	useEffect(() => {
		// This function will be defined and then called within the effect
		const initializeSession = async () => {
			// **Guard Clause**: Wait until all dependencies are loaded and valid
			if (
				isSessionLoading ||
				isProfileLoading ||
				!profileRes?.profileInfo ||
				!characterRes?.characterInfo
			) {
				return; // Do nothing until all data is ready
			}

			try {
				// **Create Session**
				const sessionInfo = await createSession.mutateAsync({
					userId,
					characterId: characterRes.characterInfo.characterId,
					profileId: profileRes.profileInfo.profileId,
					firstCharMessage: characterRes.characterInfo.firstMessage,
				});

				// **Create and Save the First Chat Turn (if applicable)**
				if (characterRes.characterInfo.firstMessage) {
					const now = new Date().toISOString();
					const sequence = 0;
					const request: ChatMessage = {
						entries: [],
						sessionId: sessionInfo.sessionId,
						sequence,
						messageType: 'request',
						role: 'user',
						showName: profileRes.profileInfo.showName,
						messageId: buildMessageId(sessionInfo.sessionId, sequence, 'request'),
						createdAt: now,
						updatedAt: now,
						emotion: DEFAULT_EMOTION,
						type: 'message',
					};
					const response: ChatMessage = {
						entries: parseTextToEntries(characterRes.characterInfo.firstMessage),
						sessionId: sessionInfo.sessionId,
						sequence,
						messageType: 'response',
						role: 'assistant',
						showName: characterRes.characterInfo.showName,
						messageId: buildMessageId(sessionInfo.sessionId, sequence, 'response'),
						createdAt: now,
						updatedAt: now,
						emotion: DEFAULT_EMOTION, // Or a specific first emotion from characterInfo
						type: 'message',
					};
					const firstTurn: TempChatTurn = {
						userId,
						sessionId: sessionInfo.sessionId,
						sequence,
						chatTurnSets: [{ request, response, setNo: 0 }],
						type: 'temp',
						tempTurnId: '', // Backend will fill these
						createdAt: '',
						updatedAt: '',
						setCount: 1,
						fixedSetNo: 0,
					};

					await saveTempChatTurn.mutateAsync(firstTurn);
				}

				// **Redirect to the new chat session**
				navigate(`/${routeConstants.CHAT}/${sessionInfo.sessionId}`, { replace: true });
			} catch (e: any) {
				console.error('Failed to create session and first chat turn:', e);
				setError('Could not create the new chat session. Please try again.');
			}
		};

		// **Initial Validation**: Check for session and required IDs early
		if (isSessionLoading) {
			return; // Wait for session to load
		}
		if (!userId || !characterId || !profileId) {
			navigate('/create-session-error', { replace: true });
			return;
		}

		initializeSession();
	}, [
		// **Dependencies**: The effect will re-run if any of these change.
		// This ensures we always work with the latest data and avoids race conditions.
		isSessionLoading,
		userId,
		isProfileLoading,
		profileRes,
		characterRes,
		characterId,
		profileId,
		navigate,
		createSession,
		saveTempChatTurn,
	]);

	// **User Feedback**: Show a loading or error state
	return (
		<Box
			display="flex"
			flexDirection="column"
			alignItems="center"
			justifyContent="center"
			sx={{ height: '80vh' }}
		>
			{error ? (
				<Typography color="error">{error}</Typography>
			) : (
				<>
					<CircularProgress />
					<Typography sx={{ mt: 2 }}>Creating new session...</Typography>
				</>
			)}
		</Box>
	);
}
