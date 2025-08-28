import { LANG_KEYS } from '#shared/config/langConstants.js';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { ProfileCdo } from '#shared/domain/profile/ProfileInterfaces.js';
import { Box, Grid, List, Typography } from '@mui/material';
import { FC } from 'react';
import { useNavigate } from 'react-router';
import { useProfileApi } from '../../hook/api/index.js';
import {
	GlassButton,
	GlassCard,
	GlassPaper,
	GlassPortraitSlider,
} from '../../layout/glass/index.js';
import { useAuth } from '../../provider/AuthProvider.jsx';
import { useToast } from '../../provider/ToastProvider.jsx';
import { routeConstants } from '../../routeConstants.js';
import { containerSpacing } from '../../style/index.js';
import { getCharacterImageArray } from '../../util/portraitUtils.js';
import { getLangAlertText, getLangText } from '../../util/translateUtils.js';
import { SessionPreviewList } from './SessionPreviewList.jsx';
import { ProfileHistoryTabs } from './ProfileHistoryTab.jsx';
import { SolidMetallicButton, RomanticTitle } from '../../layout/index.js';

const CharacterPage: FC<{ characterInfo: CharacterInfo; userId: string }> = ({
	characterInfo,
	userId,
}) => {
	const { openLoginModal, isLoggedIn } = useAuth();
	const navigate = useNavigate();
	const { addToast } = useToast();
	const characterId = characterInfo.characterId;

	// Character state: portraits, loading, error
	// profile state
	const { storeProfile } = useProfileApi();

	// Handlers
	const handleHistory = (historyId: string) => {
		navigate(`/${routeConstants.HISTORY}/${historyId}`);
	};

	const handleStartSession = (sessionId: string) => {
		navigate(`/${routeConstants.CHAT}/${sessionId}`);
	};

	const handleStartNewSession = async (profileCdo: ProfileCdo) => {
		if (import.meta.env.VITE_APP_MODE === 'static') {
			addToast(getLangAlertText(LANG_KEYS.STATIC_SESSION_DISABLE), 'error');
			return;
		}
		if (!isLoggedIn) {
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
	const portraits = getCharacterImageArray(characterId);

	return (
		<GlassPaper key="character-page" className="paper">
			<Grid container spacing={containerSpacing}>
				{/* Left Column */}
				<Grid
					size={{ xs: 12, md: 4 }}
					sx={{
						// Define this column as a sticky "pillar" on larger screens.
						position: { xs: 'static', md: 'sticky' },

						// Pin it to the top of the scrollable <main> area, respecting its padding.
						top: (theme) => theme.spacing(2),

						// Prevent this column from stretching if the right-side content is taller.
						alignSelf: 'flex-start',

						// --- THE CORRECTED HEIGHT CALCULATION ---
						// We subtract the header, footer, main's padding (2*2), and paper's padding (2*2).
						height: {
							xs: 'auto', // On mobile, height is automatic.
							md: (theme) =>
								`calc(100vh - var(--header-height) - var(--footer-height) - ${theme.spacing(8)})`,
						},
						// --- FLEXBOX CENTERING FOR THE IMAGE ---
						// These properties ensure the image is centered within the pillar and scales correctly.
						display: 'flex',
						flexDirection: 'column',
						gap: 2,
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
						{!!portraits ? (
							<GlassPortraitSlider imageUrls={portraits.slice(0, 3)} />
						) : (
							<Box width={200} height={200} bgcolor="#eee" borderRadius={3} />
						)}
					</Box>
					{!isLoggedIn && (
						<SolidMetallicButton colorVariant="gold" variant="outlined" onClick={openLoginModal}>
							{getLangText(LANG_KEYS.START_NEW_SESSION)}
						</SolidMetallicButton>
					)}
				</Grid>

				{/* Right Column: Using the correct MUI v7 'size' prop */}
				<Grid size={{ xs: 12, md: 8 }}>
					<Box display="flex" flexDirection="column" gap={2}>
						{/* Title and Description Card */}
						<GlassCard variant="outlined">
							<Box
								sx={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									mt: 1,
									ml: 1,
								}}
							>
								<RomanticTitle noGlow hover variant="h6" color="primary">
									{characterInfo.showName}
								</RomanticTitle>
								{/* <GlassButton colorVariant="silver" variant="outlined" onClick={handleOpenModal}>
									{getLangText(LANG_KEYS.EDIT)}
								</GlassButton> */}
							</Box>
							<Typography variant="body2" mt={1} ml={2}>
								{characterInfo.description}
							</Typography>
						</GlassCard>
						{isLoggedIn && (
							<>
								{/* Session List Card */}
								<GlassCard variant="outlined">
									<Typography variant="subtitle1" color="text.secondary" mb={1}>
										{getLangText('SESSIONS_WITH_CHARACTER')}
									</Typography>
									<List dense>
										<SessionPreviewList
											userId={userId}
											characterId={characterId}
											handleSessionStart={handleStartSession}
										/>
									</List>
								</GlassCard>
								{/* Profile Card */}
								<ProfileHistoryTabs
									userId={userId}
									characterId={characterId}
									onSubmit={handleStartNewSession}
									onHistory={handleHistory}
								/>
							</>
						)}
					</Box>
				</Grid>
			</Grid>
		</GlassPaper>
	);
};

export default CharacterPage;
