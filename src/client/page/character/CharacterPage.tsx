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
	Paper,
	Grid,
} from '@mui/material';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { useCharacterState } from '../../hook/state/useCharacterState.js';
import { SessionPreviewList } from './SessionPreviewList.jsx';
import { useNavigate } from 'react-router';
import { routeConstants } from '../../routeConstants.js';
import { CharacterPortrait } from './CharacterPortrait.jsx';
import { ProfileCdo, ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { ProfileCard } from './ProfileCard.jsx';
import { useProfileApi } from '../../hook/api/useProfileApi.js';
import { useAuthModal } from '../../provider/AuthModalProvider.jsx';
import { alertConstants, LANG_KEYS } from '#shared/config/langConstants.js';
import { getLangAlertText, getLangText } from '#shared/util/languageUtils.js';

const CharacterPage: FC<{ characterInfo: CharacterInfo; userId: string }> = ({
	characterInfo,
	userId,
}) => {
	const navigate = useNavigate();
	const characterId = characterInfo.characterId;
	const [profileId, setProfileId] = useState('');
	const { openLoginModal } = useAuthModal();

	// Character state: portraits, loading, error
	const { portraitMap, isLoadingPortraits, portraitError } = useCharacterState(
		characterId,
		characterInfo
	);
	// profile state
	const { storeProfile } = useProfileApi();

	// Handlers
	const handleStartNewSession = () => {
		if (!userId) {
			openLoginModal();
			return;
		}

		if (!profileId) {
			alert(getLangAlertText(LANG_KEYS.CREATE_NEW_PROFILE));
			return;
		}
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
		<Paper className="paper">
			<Grid container spacing={3}>
				{/* Left Column: Using the correct MUI v7 'size' prop */}
				<Grid size={{ xs: 12, md: 5 }}>
					<Box display="flex" justifyContent="center">
						{isLoadingPortraits ? (
							<CircularProgress />
						) : portraitUrl ? (
							<CharacterPortrait imageUrl={portraitUrl} />
						) : (
							<Box width={200} height={200} bgcolor="#eee" borderRadius={3} />
						)}
					</Box>
				</Grid>

				{/* Right Column: Using the correct MUI v7 'size' prop */}
				<Grid size={{ xs: 12, md: 7 }}>
					<Box display="flex" flexDirection="column" gap={2}>
						{/* Title and Description Card */}
						<Card variant="outlined">
							<CardContent>
								<Typography variant="subtitle1" color="primary" mt={1}>
									{characterInfo.showName}
								</Typography>
								<Typography variant="body2" mt={2}>
									{characterInfo.description}
								</Typography>
							</CardContent>
						</Card>

						{/* Session List Card */}
						<Card variant="outlined">
							<CardContent>
								<Typography variant="subtitle1" color='text.secondary' mb={1}>
									{getLangText('SESSIONS_WITH_CHARACTER')}
								</Typography>
								{userId && (
									<List dense>
										<SessionPreviewList
											userId={userId}
											characterId={characterId}
											handleSessionStart={handleStartSession}
										/>
									</List>
								)}
							</CardContent>
						</Card>

						{/* Profile Card */}
						{userId && <ProfileCard userId={userId} onSubmit={handleSubmitProfile} />}

						{/* Start New Session Button */}
						<Box display="flex" justifyContent="flex-end" mt={2}>
							<Button variant="contained" color="primary" size="large" onClick={handleStartNewSession}>
								Start New Session
							</Button>
						</Box>
					</Box>
				</Grid>
			</Grid>
		</Paper>
	);
};

export default CharacterPage;
