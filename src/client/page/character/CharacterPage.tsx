import { LANG_KEYS } from '#shared/config/langConstants.js';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { ProfileCdo } from '#shared/domain/profile/ProfileInterfaces.js';
import { Box, Grid, List, Typography } from '@mui/material';
import { FC } from 'react';
import { useNavigate } from 'react-router';
import { useProfileApi } from '../../hook/api/index.js';
import { GlassCard, GlassPaper, GlassPortraitSlider } from '../../layout/glass/index.js';
import { RomanticTitle } from '../../layout/RomanticTitle.jsx';
import { useAuth } from '../../provider/AuthProvider.jsx';
import { useToast } from '../../provider/ToastProvider.jsx';
import { routeConstants } from '../../routeConstants.js';
import { containerSpacing } from '../../style/index.js';
import { getCharacterImageArray } from '../../util/portraitUtils.js';
import { getLangAlertText, getLangText } from '../../util/translateUtils.js';
import { ProfileCard } from './ProfileCard.jsx';
import { SessionPreviewList } from './SessionPreviewList.jsx';

const CharacterPage: FC<{ characterInfo: CharacterInfo; userId: string }> = ({
	characterInfo,
	userId,
}) => {
	const { openLoginModal } = useAuth();
	const navigate = useNavigate();
	const { addToast } = useToast();
	const characterId = characterInfo.characterId;

	// Character state: portraits, loading, error
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
						alignItems: 'center',
						justifyContent: 'center',
					}}
				>
					<Box sx={{ height: '100%', width: '100%', display: 'flex' }}>
						{!!portraits ? (
							<GlassPortraitSlider imageUrls={portraits.slice(0, 3)} />
						) : (
							<Box width={200} height={200} bgcolor="#eee" borderRadius={3} />
						)}
					</Box>
				</Grid>

				{/* Right Column: Using the correct MUI v7 'size' prop */}
				<Grid size={{ xs: 12, md: 8 }}>
					<Box display="flex" flexDirection="column" gap={2}>
						{/* Title and Description Card */}
						<GlassCard variant="outlined">
							<RomanticTitle noGlow hover variant="h6" color="primary" mt={1} ml={1}>
								{characterInfo.showName}
							</RomanticTitle>
							<Typography variant="body2" mt={1} ml={2}>
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
						<ProfileCard userId={userId} onSubmit={handleStartNewSession} />
					</Box>
				</Grid>
			</Grid>
		</GlassPaper>
	);
};

export default CharacterPage;
