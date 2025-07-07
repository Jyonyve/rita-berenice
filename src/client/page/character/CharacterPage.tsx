import React, { FC, useState } from 'react';
import {
	Box,
	Typography,
	Button,
	Card,
	CardContent,
	Avatar,
	List,
	ListItem,
	ListItemText,
	CircularProgress,
} from '@mui/material';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { useCharacterState } from '../../hook/state/useCharacterState.js';
import { UserInfo } from '#shared/domain/user/UserInterfaces.js';
import { SessionPreviewList } from './SessionPreviewList.jsx';
import { useNavigate } from 'react-router';
import { routeConstants } from '../../routeConstants.js';
import { CharacterPortrait } from './CharacterPortrait.jsx';
import { useProfileState } from '../../hook/index.js';
import { ProfileCdo, ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { ProfileCard } from './ProfileCard.jsx';
import { useProfileApi } from '../../hook/api/useProfileApi.js';

const CharacterPage: FC<{ characterInfo: CharacterInfo; userId: string }> = ({
	characterInfo,
	userId,
}) => {
	const navigate = useNavigate();
	const characterId = characterInfo.characterId;
	const [profileId, setProfileId] = useState('');

	// Character state: portraits, loading, error
	const { portraitMap, isLoadingPortraits, portraitError } = useCharacterState(
		characterId,
		characterInfo
	);
	// profile state
	const { storeProfile } = useProfileApi();

	// Handlers
	const handleStartNewSession = () => {
		if (!profileId) return;
		navigate(`/${routeConstants.CHAT}`, { state: { characterId, profileId } });
	};

	const handleStartSession = (sessionId: string) => {
		navigate(`/${routeConstants.CHAT}/${sessionId}`);
	};

	const handleSubmitProfile = async (profileCdo: ProfileCdo) => {
		const profileId: string = JSON.parse(await storeProfile(profileCdo)).profileId;
		setProfileId(profileId);
	};

	// Portrait: pick default or first available
	const portraitUrl =
		!isLoadingPortraits && portraitMap && Object.values(portraitMap)[0]
			? Object.values(portraitMap)[0]
			: '';

	return (
		<Box display="flex" flexDirection="row" width="100%" minHeight="80vh" p={4} gap={4}>
			{/* Left: Portrait */}
			<Box flex="0 0 240px" display="flex" alignItems="flex-start" justifyContent="center">
				{isLoadingPortraits ? (
					<CircularProgress />
				) : portraitUrl ? (
					<CharacterPortrait imageUrl={portraitUrl} />
				) : (
					<Box width={200} height={200} bgcolor="#eee" borderRadius={3} />
				)}
			</Box>

			{/* Right: Info and actions */}
			<Box flex="1 1 0" display="flex" flexDirection="column" gap={3}>
				{/* Title and Description */}
				<Card variant="outlined">
					<CardContent>
						<Typography variant="subtitle1" color="text.secondary" mt={1}>
							{characterInfo.showName}
						</Typography>
						<Typography variant="body1" mt={2}>
							{characterInfo.description}
						</Typography>
					</CardContent>
				</Card>

				{/* Session List */}
				<Card variant="outlined">
					<CardContent>
						<Typography variant="h6" mb={1}>
							Sessions with this character
						</Typography>
						{userId && (
							<List dense>
								<SessionPreviewList userId={userId} handleSessionStart={handleStartSession} />
							</List>
						)}
					</CardContent>
				</Card>

				{/* User Character Info */}
				{userId && <ProfileCard userId={userId} onSubmit={handleSubmitProfile} />}

				{/* Start New Session */}
				<Box display="flex" justifyContent="flex-end" mt={2}>
					<Button variant="contained" color="primary" size="large" onClick={handleStartNewSession}>
						Start New Session
					</Button>
				</Box>
			</Box>
		</Box>
	);
};

export default CharacterPage;
