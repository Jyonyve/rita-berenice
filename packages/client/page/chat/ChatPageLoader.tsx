// src/client/page/ChatPageLoader.tsx
import React, { useEffect, useMemo, useState, useCallback, createContext, useContext } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';
import {
	Typography,
	CircularProgress,
	Box,
	Dialog,
	DialogContent,
	IconButton,
	useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {
	useChatApi,
	useCharacterApi,
	useProfileApi,
	useTempChatApi,
	useSessionApi,
} from '../../hook/api/index.js';
import { ChatPage } from './ChatPage.jsx';
import { useAuth } from '../../provider/AuthProvider.jsx';
import { HeaderContextType } from '../../layout/RootLayout.jsx';
import { getImageForEmotion } from '../../util/portraitUtils.js';
import { GlassCircularProgress } from '../../layout/component/glass/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { ProfileForm } from '../character/ProfileForm.tsx';
import { useResponsive } from '../../hook/useResponsive.js';
import { DEFAULT_EMOTION, LANG_KEYS } from '@rita-berenice/shared/config';
import { ProfileInfo, ProfileCdo } from '@rita-berenice/shared/domain';
import { parseSessionId } from '@rita-berenice/shared/util';
import { getConversationAvatar } from './conversationAvatarUtils.js';

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
	const { isSessionLoading, userId, userProfile } = useAuth();
	const { setHeaderInfo, setSessionHeaderHidden, headerInfo } =
		useOutletContext<HeaderContextType>();

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

	// Every hook below has to run on each render, so the "no session yet" bail-out cannot happen
	// here - it lives with the other early returns further down, after the last hook. Until the
	// route params resolve, the queries receive an empty id and stay disabled by their own
	// `enabled: !!id` guards, so nothing is fetched.
	const safeSessionId = sessionId ?? '';

	// ------------ Fetching Data ------------
	const characterId = useMemo(
		() => parseSessionId(safeSessionId)?.characterId || '',
		[safeSessionId]
	);

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
	} = getProfileBySessionId(safeSessionId);

	// Subscribed here only for the error gate below; useChatState owns the data for this query.
	const { isLoading: isLoadingTurns, isError: isTurnsError } =
		useChatApi().getAllDisplayTurns(safeSessionId);

	const {
		data: sessionRes,
		isLoading: isLoadingSession,
		isError: isSessionError,
	} = useSessionApi().getSession(safeSessionId);

	// Generate image URL based on current emotion
	const imageUrl = useMemo(() => {
		if (characterRes?.characterInfo) {
			return (
				getImageForEmotion(
					characterRes.characterPortraits[characterRes.characterInfo.characterId],
					currentEmotion
				) || ''
			);
		}
		return '';
	}, [characterRes, currentEmotion]);

	// Emotion context value. Memoized: an unmemoized object re-renders every consumer on every
	// render of this loader, and the loader re-renders whenever RootLayout's header state moves.
	// It has to be declared here, above the early returns below, to stay an unconditional hook.
	const emotionContextValue: EmotionContextType = useMemo(
		() => ({ currentEmotion, setCurrentEmotion, imageUrl, showMobileImage, setShowMobileImage }),
		[currentEmotion, imageUrl, showMobileImage]
	);

	// --- HEADER INFO MANAGEMENT (enhanced) ---
	useEffect(() => {
		if (characterRes?.characterInfo && profileRes?.profileInfo && sessionRes?.sessionInfo) {
			const info = characterRes.characterInfo;
			const profile = profileRes.profileInfo;
			const sessionTitle = sessionRes.sessionInfo.title;

			// This part remains the same. You are correctly creating a new object.
			setHeaderInfo({
				characterId: info.characterId,
				profileShowName: profile.showName,
				sessionId: safeSessionId,
				sessionTitle,
				avatarUrl: getConversationAvatar(
					characterRes.characterAvatars[info.characterId],
					characterRes.characterPortraits[info.characterId],
					DEFAULT_EMOTION
				),
				mobileImageUrl: imageUrl,
			});
		}
	}, [
		characterRes,
		profileRes,
		sessionRes,
		setHeaderInfo,
		shouldUseMobileLayout,
		imageUrl,
		safeSessionId,
	]);

	// Clearing the header belongs to unmount only. While it lived in the effect above it ran on
	// every dependency change too - and `imageUrl` is a dependency, so each scroll-driven emotion
	// change blanked the header for a frame (RootLayout falls back to an empty session header)
	// before refilling it. That blank frame is the header flicker.
	useEffect(() => {
		return () => {
			setHeaderInfo(undefined);
		};
	}, [setHeaderInfo]);

	useEffect(() => {
		if (headerInfo?.editModalOpen) {
			setIsEditModalOpen(true);
			// Immediately reset the signal to prevent re-triggering
			setHeaderInfo({ ...headerInfo, editModalOpen: false });
		}
	}, [headerInfo, setHeaderInfo]);

	// The IndexedDB priming effect that used to live here was removed: useChatState already writes
	// the same query result to the same store, so every session load wrote the full turn list
	// twice.

	// Nothing to render without a session or a signed-in user. The redirect effect above already
	// sends a missing sessionId to the not-found route; this only keeps the render empty until it
	// does. It sits below every hook so the hook order never changes between renders.
	if (!sessionId || !userId) return null;

	// Handle error states
	if (isCharacterError || isProfileError || isTurnsError || isSessionError) {
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

	return (
		<EmotionContext.Provider value={emotionContextValue}>
			<ChatPage
				characterInfo={characterInfo}
				profileInfo={profileInfo}
				sessionInfo={sessionInfo}
				userId={userId}
				characterPortraitUrls={characterRes.characterPortraits[characterInfo.characterId]}
				characterAvatarUrls={characterRes.characterAvatars[characterInfo.characterId]}
				profileAvatarUrl={profileRes.profileAvatars[profileInfo.profileId] ?? userProfile?.avatarUrl}
				onMobileInputFocusChange={setSessionHeaderHidden}
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
					portraitUrl={profileRes.profilePortraits[profileInfo.profileId]}
					avatarUrl={profileRes.profileAvatars[profileInfo.profileId]}
					open={isEditModalOpen}
					onClose={handleCloseEditModal}
					onSubmit={handleEditSubmit}
				/>
			)}
		</EmotionContext.Provider>
	);
}
