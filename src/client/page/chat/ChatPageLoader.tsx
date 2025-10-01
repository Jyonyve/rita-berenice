// src/client/page/ChatPageLoader.tsx
import React, { useEffect, useMemo, useState, useCallback, createContext, useContext } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router';
import {
	Typography,
	CircularProgress,
	Box,
	Dialog,
	DialogContent,
	IconButton,
	useMediaQuery,
	useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { parseSessionId } from '#shared/util/parseUtils.js';
import {
	useChatApi,
	useCharacterApi,
	useProfileApi,
	useTempChatApi,
	useSessionApi,
} from '../../hook/api/index.js';
import { saveMessagesToCache } from '../../util/idbUtils.js';
import { ChatPage } from './ChatPage.jsx';
import { useAuth } from '../../provider/AuthProvider.jsx';
import { HeaderContextType } from '../../layout/RootLayout.jsx';
import { getDefaultImage, getImageForEmotion } from '../../util/portraitUtils.js';
import { DEFAULT_EMOTION } from '#shared/config/emotionConstants.js';
import { GlassCircularProgress } from '../../layout/glass/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { LANG_KEYS } from '#shared/config/langConstants.js';
import { ProfileCdo, ProfileInfo } from '#shared/domain/profile/profile.type.js';
import { ProfileForm } from '../character/ProfileForm.tsx';
import { useResponsive } from '../../hook/useResponsive.js';

// Create Emotion Context for ChatPage communication
interface EmotionContextType {
	currentEmotion: string;
	setCurrentEmotion: (emotion: string) => void;
	imageUrl: string;
	showMobileImage: boolean;
	setShowMobileImage: (show: boolean) => void;
}

const EmotionContext = createContext<EmotionContextType | null>(null);

export const useEmotionContext = () => {
	const context = useContext(EmotionContext);
	if (!context) {
		throw new Error('useEmotionContext must be used within EmotionContext.Provider');
	}
	return context;
};

export function ChatPageLoader() {
	const navigate = useNavigate();
	const { sessionId } = useParams();
	const { state } = useLocation();
	const { isSessionLoading, userId } = useAuth();
	const { setHeaderInfo, headerInfo } = useOutletContext<HeaderContextType>();

	// --- RESPONSIVE DETECTION (moved from ChatPage) ---
	const { shouldUseMobileLayout } = useResponsive();

	// --- EMOTION STATE  ---
	const [currentEmotion, setCurrentEmotion] = useState<string>(DEFAULT_EMOTION);
	const [showMobileImage, setShowMobileImage] = useState(false);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);

	const handleCloseEditModal = () => {
		setIsEditModalOpen(false);
	};

	const handleEditSubmit = async (profileData: ProfileInfo | ProfileCdo) => {
		await storeProfile(profileData);
		handleCloseEditModal();
	};

	// ------------ Redirect Logic ------------
	useEffect(() => {
		if (!sessionId) {
			navigate('/not-found-sessionId', { replace: true });
		}
	}, [sessionId, navigate]);

	if (!sessionId || !userId) return;

	// ------------ Fetching Data ------------
	const characterId = useMemo(() => parseSessionId(sessionId)?.characterId || '', [sessionId]);

	const {
		data: characterRes,
		isLoading: isLoadingCharacter,
		isError: isCharacterError,
	} = useCharacterApi().getCharacter(characterId);

	const { getProfileBySessionId, storeProfile } = useProfileApi();
	const {
		data: profileRes,
		isLoading: isLoadingProfile,
		isError: isProfileError,
	} = getProfileBySessionId(sessionId);

	const {
		data: allTurnsRes,
		isLoading: isLoadingTurns,
		isError: isTurnsError,
	} = useChatApi().getAllDisplayTurns(sessionId);

	const {
		data: sessionRes,
		isLoading: isLoadingSession,
		isError: isSessionError,
	} = useSessionApi().getSession(sessionId);

	// Generate image URL based on current emotion
	const imageUrl = useMemo(() => {
		if (characterRes?.characterInfo) {
			return getImageForEmotion(characterRes.characterInfo.characterId, currentEmotion) || '';
		}
		return '';
	}, [characterRes, currentEmotion]);

	// --- HEADER INFO MANAGEMENT (enhanced) ---
	useEffect(() => {
		if (characterRes?.characterInfo && profileRes?.profileInfo && state) {
			const info = characterRes.characterInfo;
			const profile = profileRes.profileInfo;
			const sessionTitle = state.title as string;

			// This part remains the same. You are correctly creating a new object.
			setHeaderInfo({
				characterId: info.characterId,
				profileShowName: profile.showName,
				sessionId,
				sessionTitle,
				avatarUrl: getDefaultImage(info.characterId),
				mobileImageUrl: shouldUseMobileLayout ? imageUrl : undefined,
			});
		}

		return () => {
			setHeaderInfo(undefined);
		};
	}, [characterRes, profileRes, setHeaderInfo, shouldUseMobileLayout, imageUrl, state, sessionId]);

	useEffect(() => {
		if (headerInfo?.editModalOpen) {
			setIsEditModalOpen(true);
			// Immediately reset the signal to prevent re-triggering
			setHeaderInfo({ ...headerInfo, editModalOpen: false });
		}
	}, [headerInfo, setHeaderInfo]);

	useEffect(() => {
		if (allTurnsRes?.displayTurns && allTurnsRes.displayTurns.length > 0) {
			console.log(`Priming IndexedDB with ${allTurnsRes.displayTurns.length} chat turns...`);
			saveMessagesToCache(allTurnsRes.displayTurns);
		}
	}, [allTurnsRes]);

	// Handle error states
	if (isCharacterError || isProfileError || isTurnsError) {
		return <Typography color="error">{getLangText(LANG_KEYS.FAILED_LOAD_CHAT)}</Typography>;
	}

	// Show loading spinner
	if (isSessionLoading || !characterRes || !profileRes || !sessionRes) {
		return (
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
				<Typography sx={{ mt: 2 }}>{getLangText(LANG_KEYS.LOADING_CHAT)}</Typography>
			</Box>
		);
	}

	const characterInfo = characterRes.characterInfo;
	const profileInfo = profileRes.profileInfo;
	const sessionInfo = sessionRes.sessionInfo;

	// Emotion context value
	const emotionContextValue: EmotionContextType = {
		currentEmotion,
		setCurrentEmotion,
		imageUrl,
		showMobileImage,
		setShowMobileImage,
	};

	return (
		<EmotionContext.Provider value={emotionContextValue}>
			<ChatPage
				characterInfo={characterInfo}
				profileInfo={profileInfo}
				sessionInfo={sessionInfo}
				userId={userId}
			/>

			{/* Mobile Image Modal */}
			<Dialog
				open={showMobileImage}
				onClose={() => setShowMobileImage(false)}
				maxWidth="sm"
				fullWidth
				slotProps={{
					paper: {
						sx: { backgroundColor: 'transparent', boxShadow: 'none', maxHeight: '80vh', margin: 2 },
					},
				}}
			>
				<DialogContent sx={{ p: 1 }}>
					<Box
						sx={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
					>
						{imageUrl && (
							<img
								src={imageUrl}
								alt={`${characterInfo.characterId} portrait`}
								style={{
									width: '100%',
									height: 'auto',
									borderRadius: 16,
									boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
								}}
							/>
						)}
						<IconButton
							onClick={() => setShowMobileImage(false)}
							sx={{
								position: 'absolute',
								top: 8,
								right: 8,
								backgroundColor: 'rgba(0, 0, 0, 0.6)',
								color: 'white',
								'&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.8)' },
							}}
						>
							<CloseIcon />
						</IconButton>
					</Box>
				</DialogContent>
			</Dialog>

			{profileInfo && (
				<ProfileForm
					userId={userId}
					mode="edit"
					profile={profileInfo}
					open={isEditModalOpen}
					onClose={handleCloseEditModal}
					onSubmit={handleEditSubmit}
				/>
			)}
		</EmotionContext.Provider>
	);
}
