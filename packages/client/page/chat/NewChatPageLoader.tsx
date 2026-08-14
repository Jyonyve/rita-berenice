// src/client/page/ChatPageLoader.tsx

import { parseTextToEntries } from '../../util/chatParseUtils.js';
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
import { GlassCircularProgress } from '../../layout/component/glass/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { DEFAULT_EMOTION, LANG_KEYS } from '@rita-berenice/shared/config';
import {
	ProfileCdo,
	ChatMessage,
	TempChatTurn,
	SessionContentPolicy,
} from '@rita-berenice/shared/domain';
import { buildMessageId } from '@rita-berenice/shared/util';

export function NewChatPageLoader() {
	const navigate = useNavigate();
	const { state } = useLocation();
	const { isSessionLoading, userId } = useAuth();
	const [error, setError] = useState<string>();

	// Ensure state exists before destructuring
	const characterId: string = state?.characterId || '';
	const profileData: ProfileCdo | undefined = state?.profileData;
	const contentPolicy: SessionContentPolicy = state?.contentPolicy === 'adult' ? 'adult' : 'general';

	// --- API and State Hooks ---
	const {
		data: characterRes,
		isLoading: isLoadingCharacter,
		isError: isCharacterError,
	} = useCharacterApi().getCharacter(characterId);
	const { createSession, initSessionProfileId } = useSessionApi();
	const { storeProfile } = useProfileApi();
	const { saveTempChatTurn } = useTempChatApi();

	useEffect(() => {
		if (!userId || !characterId || !profileData) {
			navigate('/create-session-error', { replace: true });
			return;
		}

		// This function will be defined and then called within the effect
		const initializeSession = async () => {
			if (isSessionLoading || isLoadingCharacter || !characterRes?.characterInfo || !profileData) {
				return; // Wait for all required data
			}

			try {
				// Step 1: Create Session (without profileId)
				const { sessionId } = await createSession({
					userId,
					characterId: characterRes.characterInfo.characterId,
					firstCharMessage: characterRes.characterInfo.firstMessage,
					contentPolicy,
				});

				// Step 2: Create Profile with the new sessionId
				const profileCdo: ProfileCdo = { ...profileData, sessionId };
				const { profileId } = await storeProfile(profileCdo);

				// Step 3: Update the Session with the new profileId to link them
				await initSessionProfileId({ sessionId, profileId });

				// **Create and Save the First Chat Turn (if applicable)**
				if (characterRes.characterInfo.firstMessage) {
					const now = new Date().toISOString();
					const sequence = 0;
					const request: ChatMessage = {
						entries: [],
						sessionId,
						sequence,
						messageType: 'request',
						role: 'user',
						showName: profileCdo.showName,
						messageId: buildMessageId(sessionId, sequence, 'request'),
						createdAt: now,
						updatedAt: now,
						emotion: DEFAULT_EMOTION,
						type: 'message',
						model: 'none',
					};
					const response: ChatMessage = {
						entries: parseTextToEntries(characterRes.characterInfo.firstMessage),
						sessionId: sessionId,
						sequence,
						messageType: 'response',
						role: 'assistant',
						showName: characterRes.characterInfo.showName,
						messageId: buildMessageId(sessionId, sequence, 'response'),
						createdAt: now,
						updatedAt: now,
						emotion: DEFAULT_EMOTION, // Or a specific first emotion from characterInfo
						type: 'message',
						model: 'none',
					};
					const firstTurn: TempChatTurn = {
						userId,
						sessionId: sessionId,
						sequence,
						chatTurnSets: [{ request, response, setNo: 0 }],
						type: 'temp',
						tempTurnId: '', // Backend will fill these
						createdAt: '',
						updatedAt: '',
						setCount: 1,
						fixedSetNo: 0,
					};

					await saveTempChatTurn(firstTurn);
				}

				// **Redirect to the new chat session**
				navigate(`/${routeConstants.CHAT}/${sessionId}`, { replace: true });
			} catch (e: any) {
				console.error('Failed to create session and first chat turn:', e);
				setError('Could not create the new chat session. Please try again.');
			}
		};

		// **Initial Validation**: Check for session and required IDs early
		if (isSessionLoading) {
			return; // Wait for session to load
		}

		initializeSession();
	}, [
		isSessionLoading,
		userId,
		characterRes,
		characterId,
		profileData,
		contentPolicy,
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
				<Box
					sx={{
						display: 'flex',
						justifyContent: 'center',
						alignItems: 'center',
						height: '80vh',
						flexDirection: 'column', // <-- Add this line
					}}
				>
					<GlassCircularProgress colorVariant="silver" />
					<Typography mt={2}>{getLangText(LANG_KEYS.CREATING_SESSION)}</Typography>
				</Box>
			)}
		</Box>
	);
}
