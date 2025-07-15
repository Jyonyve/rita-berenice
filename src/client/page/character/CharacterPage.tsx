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
import { ProfileCdo } from '#shared/domain/profile/ProfileInterfaces.js';
import { ProfileCard } from './ProfileCard.jsx';
import { useProfileApi } from '../../hook/api/index.js';
import { useAuthModal } from '../../provider/AuthModalProvider.jsx';
import { containerSpacing, containerPadding as containerPadding } from '../../style/index.js';
import { getLangText, getLangAlertText } from '#shared/util/languageUtils.js';
import { GlassCard, GlassPaper, GlassPortrait } from '../../layout/glass/index.js';
import { RomanticTitle } from '../../layout/RomanticTitle.jsx';
import { useToast } from '../../provider/ToastProvider.jsx';
import { LANG_KEYS } from '#shared/config/langConstants.js';

const CharacterPage: FC<{ characterInfo: CharacterInfo; userId: string }> = ({
	characterInfo,
	userId,
}) => {
	const navigate = useNavigate();
	const { addToast } = useToast();
	const characterId = characterInfo.characterId;
	const { openLoginModal } = useAuthModal();

	// Character state: portraits, loading, error
	const { portraitMap, isLoadingPortraits, portraitError } = useCharacterState(
		characterId,
		characterInfo
	);
	// profile state
	const { storeProfile } = useProfileApi();

	// Handlers
	const handleStartSession = (sessionId: string) => {
		navigate(`/${routeConstants.CHAT}/${sessionId}`);
	};

	const handleStartNewSession = async (profileCdo: ProfileCdo) => {
		if (import.meta.env.VITE_APP_MODE === 'static') {
			addToast(getLangAlertText(LANG_KEYS.STATIC_SESSION_DISABLE), 'error');
			return;
		}
		if (!userId) {
			openLoginModal();
			return;
		}

		try {
			const result = await storeProfile(profileCdo);
			const { profileId } = JSON.parse(result);

			if (profileId) {
				navigate(`/${routeConstants.CHAT}`, { state: { characterId, profileId } });
			} else {
				alert('Failed to create a profile. Please try again.');
			}
		} catch (error) {
			console.error('Error starting new session:', error);
			alert('An error occurred while starting the session.');
		}
	};

	// Portrait: pick default or first available
	const portraitUrl =
		!isLoadingPortraits && portraitMap && Object.values(portraitMap)[0]
			? Object.values(portraitMap)[0]
			: '';

	return (
		<GlassPaper className="paper" sx={{ position: 'relative' }}>
			<Grid container spacing={containerSpacing} padding={containerPadding}>
				{/* Left Column */}
				<Grid
					size={{ xs: 12, md: 5 }}
					sx={{
						position: { xs: 'static', md: 'sticky' },
						top: (theme) => theme.spacing(2),
						alignSelf: 'flex-start',
						height: (theme) => ({
							xs: 'auto',
							md: `calc(100vh - var(--header-height, 64px) - var(--footer-height, 37px) - ${theme.spacing(
								2
							)} * 2)`,
						}),
					}}
				>
					<Box sx={{ height: '100%', display: 'flex' }}>
						{isLoadingPortraits ? (
							<CircularProgress />
						) : portraitUrl ? (
							// Use the new 'fit' prop here
							<GlassPortrait imageUrl={portraitUrl} />
						) : (
							<Box width={200} height={200} bgcolor="#eee" borderRadius={3} />
						)}
					</Box>
				</Grid>

				{/* Right Column: Using the correct MUI v7 'size' prop */}
				<Grid size={{ xs: 12, md: 7 }}>
					<Box display="flex" flexDirection="column" gap={2}>
						{/* Title and Description Card */}
						<GlassCard variant="outlined">
							<RomanticTitle noGlow isHovered variant="h6" color="primary" mt={1}>
								{characterInfo.showName}
							</RomanticTitle>
							<Typography variant="body1" mt={2}>
								{characterInfo.description}
							</Typography>
						</GlassCard>

						{/* Session List Card */}
						<GlassCard variant="outlined">
							<Typography variant="subtitle1" color="text.secondary" mb={1}>
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
						</GlassCard>

						{/* Profile Card */}
						{userId && <ProfileCard userId={userId} onSubmit={handleStartNewSession} />}
					</Box>
				</Grid>
			</Grid>
		</GlassPaper>
	);
};

export default CharacterPage;
