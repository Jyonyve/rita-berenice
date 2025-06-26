// src/client/page/ChatPageLoader.tsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { Typography, CircularProgress, Box } from '@mui/material';
import { ChatPage } from './chat/ChatPage.tsx';
import { useCharacterApi, useProfileApi } from '../hook/index.ts';
import { get } from 'http';
import { parseSessionId } from '#root/src/shared/index.ts';

// In a real implementation, you would use `useLoaderData` to get pre-fetched data.
// For now, we'll just display the IDs from the URL.

export function ChatPageLoader() {
	const { sessionId } = useParams();
	if (!sessionId) return;

	const { getCharacter } = useCharacterApi();
	const { getProfileBySessionId } = useProfileApi();
	const { characterId } = parseSessionId(sessionId);
	const { data: characterRes, isFetched: isCharacterFetched } = getCharacter(characterId);
	const { data: profileRes, isFetched: isProfileFetched } = getProfileBySessionId(sessionId);

	if (!characterRes || !profileRes) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
				<CircularProgress />
			</Box>
		);
	}

	const characterInfo = characterRes.characterInfo;
	const profileInfo = profileRes.profileInfo;

	return (
		<div>
			<Typography variant="h4" gutterBottom>
				Chat with {characterInfo.showName}
			</Typography>
			<Typography variant="subtitle1" color="text.secondary">
				Using profile: {profileInfo.showName}
			</Typography>
			<Box mt={2}>
				{/* ChatLog, UserInput, and other chat components will go here */}
				<Typography variant="body1">Chat interface will be rendered here.</Typography>
				<ChatPage characterInfo={characterInfo} profileInfo={profileInfo} sessionId={sessionId} />
			</Box>
		</div>
	);
}
