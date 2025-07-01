// src/client/page/ChatPageLoader.tsx
import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Typography, CircularProgress, Box } from '@mui/material';
import { ChatPage } from './chat/ChatPage.tsx';
import { useCharacterApi, useChatApi, useProfileApi } from '../hook/index.js';
import { parseSessionId } from '#shared/index.js';
import { saveMessagesToCache } from '../util/index.js';

// In a real implementation, you would use `useLoaderData` to get pre-fetched data.
// For now, we'll just display the IDs from the URL.

export function ChatPageLoader() {
	const navigate = useNavigate();
	const { sessionId } = useParams();

	// ------------ Redirect if sessionId is not provided ------------
	useEffect(() => {
		if (!sessionId) {
			navigate('/not-found-sessionId', { replace: true });
		}
	}, [sessionId, navigate]);

	if (!sessionId) {
		return null; // Render nothing while redirecting
	}

	// ------------ Fetching Data ------------
	const { characterId } = parseSessionId(sessionId);
	const {
		data: characterRes,
		isLoading: isLoadingCharacter,
		isError: isCharacterError,
	} = useCharacterApi().getCharacter(characterId);
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

	return <ChatPage characterInfo={characterInfo} profileInfo={profileInfo} sessionId={sessionId} />;
}
