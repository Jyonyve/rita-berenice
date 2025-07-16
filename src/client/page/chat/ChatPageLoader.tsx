// src/client/page/ChatPageLoader.tsx
import React, { useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';
import { Typography, CircularProgress, Box } from '@mui/material';
import { parseSessionId } from '#shared/util/chatParseUtils.js';
import { useChatApi, useCharacterApi, useProfileApi } from '../../hook/api/index.js';
import { saveMessagesToCache } from '../../util/idbUtils.js';
import { ChatPage } from './ChatPage.jsx';
import { useAuth } from '../../provider/AuthProvider.jsx';
import { HeaderContextType } from '../../layout/RootLayout.jsx';
import { getDefaultImage } from '../../util/portraitUtils.js';

// In a real implementation, you would use `useLoaderData` to get pre-fetched data.
// For now, we'll just display the IDs from the URL.

export function ChatPageLoader() {
	const navigate = useNavigate();
	const { sessionId } = useParams();
	const { isSessionLoading, userId } = useAuth();

	// ------------ Redirect if sessionId is not provided ------------
	useEffect(() => {
		if (!sessionId) {
			navigate('/not-found-sessionId', { replace: true });
		}
	}, [sessionId, navigate]);

	if (!sessionId) return;

	// ------------ Fetching Data ------------
	const characterId = useMemo(() => parseSessionId(sessionId)?.characterId || '', [sessionId]);
	const setHeaderInfo = useOutletContext<HeaderContextType>();

	const {
		data: characterRes,
		isLoading: isLoadingCharacter,
		isError: isCharacterError,
	} = useCharacterApi().getCharacter(characterId);
	useEffect(() => {
		if (characterRes?.characterInfo) {
			const info = characterRes.characterInfo;
			// This hook assumes you have the default image URL available.
			// If not, you might need to construct it or fetch it.
			const avatarUrl = getDefaultImage(info.characterId);

			// 2. Call the function from the parent to update the header
			setHeaderInfo({ characterId: info.characterId, showName: info.showName, avatarUrl });
		}

		// 3. Cleanup: Clear the header info when navigating away from this page
		return () => {
			setHeaderInfo();
		};
	}, [characterRes, setHeaderInfo]);

	const {
		data: profileRes,
		isLoading: isLoadingProfile,
		isError: isProfileError,
	} = useProfileApi().getProfileBySessionId(sessionId);

	const {
		data: allTurnsRes,
		isLoading: isLoadingTurns,
		isError: isTurnsError,
	} = useChatApi().getAllChatTurns(sessionId);
	useEffect(() => {
		if (allTurnsRes?.chatTurns && allTurnsRes.chatTurns.length > 0) {
			console.log(`Priming IndexedDB with ${allTurnsRes.chatTurns.length} chat turns...`);
			saveMessagesToCache(allTurnsRes.chatTurns);
		}
	}, [allTurnsRes]); // This effect runs only when allTurnsRes changes

	// DEBUG: Handle error states
	// Handle combined error states
	if (isCharacterError || isProfileError || isTurnsError) {
		return (
			<Typography color="error">Failed to load essential chat data. Please try again.</Typography>
		);
	}

	// Show a loading spinner while either query is in flight
	if (
		isSessionLoading ||
		isLoadingCharacter ||
		isLoadingProfile ||
		isLoadingTurns ||
		!characterRes?.characterInfo ||
		!profileRes?.profileInfo
	) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
				<CircularProgress />
			</Box>
		);
	}

	const characterInfo = characterRes.characterInfo;
	const profileInfo = profileRes.profileInfo;

	return (
		<ChatPage
			characterInfo={characterInfo}
			profileInfo={profileInfo}
			sessionId={sessionId}
			userId={userId}
		/>
	);
}
