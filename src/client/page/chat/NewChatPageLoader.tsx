// src/client/page/ChatPageLoader.tsx

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useSessionContext } from 'supertokens-auth-react/recipe/session/index.js';
import { ChatMessage, TempChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { DEFAULT_EMOTION } from '#shared/config/emotionWordsMapper.js';
import { useCharacterState } from '../../hook/state/useCharacterState.js';
import { useProfileApi, useSessionApi, useTempChatApi } from '../../hook/api/index.js';
import { parseTextToEntries } from '#shared/util/chatParseUtils.js';
import { buildMessageId } from '#shared/util/buildIdUtils.js';
import { Box, CircularProgress, Typography } from '@mui/material';
import { routeConstants } from '../../routeConstants.js';

export function NewChatPageLoader() {
	const navigate = useNavigate();
	const { state } = useLocation();
	const session = useSessionContext();
	const [error, setError] = useState<string | null>(null);

	// Ensure state exists before destructuring
	const characterId: string | undefined = state?.characterId;
	const profileId: string | undefined = state?.profileId;

	// --- API and State Hooks ---
	const { createSession } = useSessionApi();
	const { data: profileRes, isLoading: isProfileLoading } = useProfileApi().getProfile(
		profileId || ''
	);
	const { characterInfo } = useCharacterState(characterId || '');
	const { saveTempChatTurn } = useTempChatApi();

	useEffect(() => {
		// This function will be defined and then called within the effect
		const initializeSession = async () => {
			// **Guard Clause**: Wait until all dependencies are loaded and valid
			if (session.loading || isProfileLoading || !profileRes?.profileInfo || !characterInfo) {
				return; // Do nothing until all data is ready
			}

			try {
				// **Create Session**
				const sessionInfo = await createSession.mutateAsync({
					userId: session.userId,
					characterId: characterInfo.characterId,
					profileId: profileRes.profileInfo.profileId,
					firstCharMessage: characterInfo.firstMessage,
				});

				// **Create and Save the First Chat Turn (if applicable)**
				if (characterInfo.firstMessage) {
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
						entries: parseTextToEntries(characterInfo.firstMessage),
						sessionId: sessionInfo.sessionId,
						sequence,
						messageType: 'response',
						role: 'assistant',
						showName: characterInfo.showName,
						messageId: buildMessageId(sessionInfo.sessionId, sequence, 'response'),
						createdAt: now,
						updatedAt: now,
						emotion: DEFAULT_EMOTION, // Or a specific first emotion from characterInfo
						type: 'message',
					};
					const firstTurn: TempChatTurn = {
						userId: session.userId,
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
		if (session.loading) {
			return; // Wait for session to load
		}
		if (!session.userId || !characterId || !profileId) {
			navigate('/create-session-error', { replace: true });
			return;
		}

		initializeSession();
	}, [
		// **Dependencies**: The effect will re-run if any of these change.
		// This ensures we always work with the latest data and avoids race conditions.
		session,
		isProfileLoading,
		profileRes,
		characterInfo,
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
