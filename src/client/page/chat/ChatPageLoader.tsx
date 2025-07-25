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
	useMediaQuery,
	useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { parseSessionId } from '#shared/util/chatParseUtils.js';
import {
	useChatApi,
	useCharacterApi,
	useProfileApi,
	useTempChatApi,
} from '../../hook/api/index.js';
import { saveMessagesToCache } from '../../util/idbUtils.js';
import { ChatPage } from './ChatPage.jsx';
import { useAuth } from '../../provider/AuthProvider.jsx';
import { HeaderContextType } from '../../layout/RootLayout.jsx';
import { getDefaultImage, getImageForEmotion } from '../../util/portraitUtils.js';
import { DEFAULT_EMOTION } from '#shared/config/emotionWordsMapper.js';
import { GlassCircularProgress } from '../../layout/glass/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { LANG_KEYS } from '#shared/config/langConstants.js';

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
	const { isSessionLoading, userId } = useAuth();
	const theme = useTheme();
	const setHeaderInfo = useOutletContext<HeaderContextType>();

	// --- RESPONSIVE DETECTION (moved from ChatPage) ---
	const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
	const isTabletPortrait = useMediaQuery(
		'(min-width: 768px) and (max-width: 1024px) and (orientation: portrait)'
	);
	const hasEnoughSpaceForDesktop = useMediaQuery('(min-width: 1200px)');
	const isWideTablet = useMediaQuery(
		'(min-width: 1024px) and (max-width: 1199px) and (orientation: landscape)'
	);

	const shouldUseMobileLayout =
		isSmallScreen || isTabletPortrait || (!hasEnoughSpaceForDesktop && !isWideTablet);

	// --- EMOTION STATE (moved from ChatPage) ---
	const [currentEmotion, setCurrentEmotion] = useState<string>(DEFAULT_EMOTION);
	const [showMobileImage, setShowMobileImage] = useState(false);

	// ------------ Redirect Logic ------------
	useEffect(() => {
		if (!sessionId) {
			navigate('/not-found-sessionId', { replace: true });
		}
	}, [sessionId, navigate]);

	if (!sessionId) return;

	// ------------ Fetching Data ------------
	const characterId = useMemo(() => parseSessionId(sessionId)?.characterId || '', [sessionId]);

	const {
		data: characterRes,
		isLoading: isLoadingCharacter,
		isError: isCharacterError,
	} = useCharacterApi().getCharacter(characterId);

	// Generate image URL based on current emotion
	const imageUrl = useMemo(() => {
		if (characterRes?.characterInfo) {
			return getImageForEmotion(characterRes.characterInfo.characterId, currentEmotion) || '';
		}
		return '';
	}, [characterRes, currentEmotion]);

	// --- HEADER INFO MANAGEMENT (enhanced) ---
	useEffect(() => {
		if (characterRes?.characterInfo) {
			const info = characterRes.characterInfo;
			const avatarUrl = getDefaultImage(info.characterId);

			const headerInfo = {
				characterId: info.characterId,
				showName: info.showName,
				avatarUrl,
				// Add mobile props only when in mobile layout
				...(shouldUseMobileLayout && imageUrl && { mobileImageUrl: imageUrl }),
			};

			setHeaderInfo(headerInfo);
		}

		return () => {
			setHeaderInfo();
		};
	}, [characterRes, setHeaderInfo, shouldUseMobileLayout, imageUrl]);

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
	if (
		isSessionLoading ||
		isLoadingCharacter ||
		isLoadingProfile ||
		isLoadingTurns ||
		!characterRes?.characterInfo ||
		!profileRes?.profileInfo
	) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
				<GlassCircularProgress colorVariant="gold" />
				<Typography sx={{ mt: 2 }}>{getLangText(LANG_KEYS.LOADING_CHAT)}</Typography>
			</Box>
		);
	}

	const characterInfo = characterRes.characterInfo;
	const profileInfo = profileRes.profileInfo;

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
				sessionId={sessionId}
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
		</EmotionContext.Provider>
	);
}
