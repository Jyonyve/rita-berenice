import { LANG_KEYS } from '@rita-berenice/shared/config/langConstants.js';
import { CharacterInfo } from '@rita-berenice/shared/domain/character/character.type.js';
import { ProfileCdo } from '@rita-berenice/shared/domain/profile/profile.type.js';
import { Box, Grid, IconButton, List, Tooltip, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { useNavigate } from 'react-router';
import { Edit as EditIcon } from '@mui/icons-material';
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
import { CharacterForm } from './CharacterForm.jsx'; // Import the form

const CharacterPage: FC<{ characterInfo: CharacterInfo; userId: string; isMine: boolean }> = ({
	characterInfo,
	userId,
	isMine,
}) => {
	const { openLoginModal, isLoggedIn } = useAuth();
	const navigate = useNavigate();
	const { addToast } = useToast();
	const characterId = characterInfo.characterId;

	// Add edit state
	const [isEditing, setIsEditing] = useState(false);

	// Handlers
	const handleHistory = (historyId: string) => {
		navigate(`/${routeConstants.HISTORY}/${historyId}`);
	};

	const handleSessionStart = (sessionId: string) => {
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

		navigate(`/${routeConstants.CHAT}`, {
			replace: true,
			state: { characterId: characterId, profileData: profileCdo },
		});
	};

	// Edit handlers
	const handleEditClick = () => {
		setIsEditing(true);
	};

	const handleEditCancel = () => {
		setIsEditing(false);
	};

	const handleEditSuccess = () => {
		setIsEditing(false);
		addToast(getLangAlertText(LANG_KEYS.CHARACTER_UPDATED_SUCCESS), 'success');
	};

	// Portrait: pick default or first available
	const portraits = getCharacterImageArray(characterId);

	// If editing, show the form instead of the display
	if (isEditing) {
		return (
			<CharacterForm
				mode="edit"
				userId={userId}
				characterInfo={characterInfo}
				onCancel={handleEditCancel}
				onSuccess={handleEditSuccess}
			/>
		);
	}

	return (
		<GlassPaper key="character-page" className="paper">
			<Grid container spacing={containerSpacing}>
				{/* Left Column */}
				<Grid
					size={{ xs: 12, md: 4 }}
					sx={{
						position: { xs: 'static', md: 'sticky' },
						top: (theme) => theme.spacing(2),
						alignSelf: 'flex-start',
						height: {
							xs: 'auto',
							md: (theme) =>
								`calc(100vh - var(--header-height) - var(--footer-height) - ${theme.spacing(8)})`,
						},
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

				{/* Right Column */}
				<Grid size={{ xs: 12, md: 8 }}>
					<Box display="flex" flexDirection="column" gap={2}>
						{/* Title and Description Card */}
						<GlassCard variant="outlined">
							<Box sx={{ mt: 1, ml: 1 }}>
								{/* Title with inline edit button */}
								<Box display="flex" alignItems="center" gap={1}>
									<RomanticTitle noGlow hover variant="h5" color="secondary" colorVariant="primary">
										{characterInfo.showName}
									</RomanticTitle>
									{/* Inline edit button like UserPage */}
									{isLoggedIn && isMine && (
										<Tooltip title={getLangText(LANG_KEYS.EDIT_CHARACTER)}>
											<IconButton
												onClick={handleEditClick}
												size="small"
												sx={{ color: 'text.secondary', '&:hover': { color: 'silver.main' } }}
											>
												<EditIcon fontSize="small" />
											</IconButton>
										</Tooltip>
									)}
								</Box>
								<Typography variant="body2" mt={1} ml={0}>
									{characterInfo.description}
								</Typography>
							</Box>
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
											handleSessionStart={handleSessionStart}
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
