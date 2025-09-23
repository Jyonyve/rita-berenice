import React, {
	FC,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { Outlet, useMatch, useNavigate } from 'react-router';
import {
	AppBar,
	Box,
	Container,
	Toolbar,
	Typography,
	CssBaseline,
	Switch,
	IconButton,
	Modal,
	Menu,
	Avatar,
	Dialog,
	DialogContent,
	useTheme,
	useMediaQuery,
} from '@mui/material';
import { useColorMode } from '../provider/ColorModeProvider.jsx';
import { EmailPasswordPreBuiltUI } from 'supertokens-auth-react/recipe/emailpassword/prebuiltui.js';
import AccountCircle from '@mui/icons-material/AccountCircle';
import { AuthPage } from 'supertokens-auth-react/ui/index.js';
import { APPNAME } from '#shared/config/constants.js';
import { useLanguage } from '../provider/LanguageProvider.jsx';
import {
	GlassPaper,
	GlassAppBar,
	GlassFooter,
	GlassMenuItem,
	GlassBox,
	GlassPortrait,
} from './glass/index.js';
import { RomanticTitle } from './RomanticTitle.jsx';
import { gold, silver } from '../style/colors.js';
import { routeConstants } from '../routeConstants.js';
import { glassEffect, glassEffectLight } from '../style/glassEffect.js';
import { getLangText } from '../util/translateUtils.js';
import { LANG_KEYS } from '#shared/config/langConstants.js';
import { useAuth } from '../provider/AuthProvider.jsx';
import ImageIcon from '@mui/icons-material/Image';
import CloseIcon from '@mui/icons-material/Close';
import { useSessionApi, useUserApi } from '../hook/api/index.js';
import { InlineEditableField } from './InlineEditableField.jsx';
import ReloadToHome from './ReloadToHome.jsx';
import { titleFontFamily } from '../style/typography.js';

interface LoginModalProps {
	loginOpen: boolean;
	handleCloseLogin: () => void;
}

const LoginModal: FC<LoginModalProps> = ({ loginOpen, handleCloseLogin }) => (
	<Modal
		open={loginOpen}
		onClose={handleCloseLogin}
		disableScrollLock={true}
		aria-labelledby="login-modal-title"
	>
		<GlassPaper
			onClick={handleCloseLogin}
			sx={{
				height: '100vh',
				width: '100vw',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				borderRadius: 0,
			}}
		>
			<Box onClick={(e) => e.stopPropagation()}>
				<AuthPage preBuiltUIList={[EmailPasswordPreBuiltUI]} />
			</Box>
		</GlassPaper>
	</Modal>
);

interface ImageModalProps {
	open: boolean;
	onClose: () => void;
	imageUrl?: string;
	characterId?: string;
}

const ImageModal: FC<ImageModalProps> = ({ open, onClose, imageUrl, characterId }) => {
	const theme = useTheme();

	if (!imageUrl) return null;

	return (
		<Dialog
			open={open}
			onClose={onClose}
			fullWidth
			slotProps={{
				paper: {
					sx: {
						backgroundColor: 'rgba(0, 0, 0, 0.6)', // Semi-transparent background
						boxShadow: 'none',
						maxWidth: 'unset',
						maxHeight: '90vh',
						overflow: 'visible',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						p: 0,
					},
				},
			}}
		>
			<DialogContent
				sx={{
					p: 0,
					m: 0,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					width: '100%',
					height: '100%',
					overflow: 'visible',
				}}
				onClick={onClose} // Close when clicking the background
			>
				<Box
					sx={{
						position: 'relative',
						display: 'flex',
						justifyContent: 'center',
						alignItems: 'center',
						maxWidth: '100%',
						maxHeight: '100%',
						overflow: 'visible',
					}}
					onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image
				>
					<GlassPortrait
						imageUrl={imageUrl}
						alt={`${characterId} portrait`}
						hover={false}
						sx={{
							width: '100%',
							height: 'auto',
							borderRadius: theme.spacing(2),
							maxHeight: '80vh',
							objectFit: 'contain',
						}}
					/>
					<IconButton
						onClick={onClose}
						sx={{
							position: 'absolute',
							top: theme.spacing(0.5),
							right: theme.spacing(0.5),
							color: 'white',
							transition: 'all 0.2s ease-in-out',
						}}
					>
						<CloseIcon />
					</IconButton>
				</Box>
			</DialogContent>
		</Dialog>
	);
};

// Add this component inside your RootLayout file
const LanguageSwitch: FC = () => {
	const { lang, toggleLang } = useLanguage();
	const isKor = lang === 'kor';
	const next = isKor ? 'English' : 'Korean';

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
		toggleLang(); // Call your toggle function
	};
	return (
		<Switch
			checked={isKor}
			onChange={() => toggleLang()}
			// ARIA switch semantics
			role="switch"
			aria-checked={isKor}
			aria-label={`Switch language to ${next}`}
			color="default"
			size="small"
			sx={{
				'& .MuiSwitch-thumb': {
					'&:before': {
						content: lang === 'kor' ? '"한"' : '"EN"',
						position: 'absolute',
						width: '100%',
						height: '100%',
						left: 0,
						top: 0,
						backgroundRepeat: 'no-repeat',
						backgroundPosition: 'center',
						fontSize: '9px',
						fontWeight: 'bold',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						color: 'black',
					},
				},
			}}
		/>
	);
};

export interface HeaderInfo {
	characterId: string;
	profileShowName: string;
	avatarUrl?: string;
	mobileImageUrl?: string;
	sessionId?: string;
	sessionTitle?: string;
	editModalOpen?: boolean;
}
export type HeaderContextType = {
	setHeaderInfo: (info?: HeaderInfo) => void;
	headerInfo?: HeaderInfo;
};

export function RootLayout() {
	const { mode, toggleMode } = useColorMode();
	const isSmallScreen = useMediaQuery((theme) => theme.breakpoints.down('md'));
	const navigate = useNavigate();
	const {
		isSessionLoading,
		isLoggedIn,
		isLoginModalOpen,
		openLoginModal,
		closeLoginModal,
		logout,
		userId,
	} = useAuth();
	const { updateSessionTitle } = useSessionApi();
	const { data: userRes } = useUserApi().getUser(userId || '');
	const headerRef = useRef<HTMLElement>(null);
	const footerRef = useRef<HTMLElement>(null);

	const [headerInfo, setHeaderInfo] = useState<HeaderInfo>();
	const [imageModalOpen, setImageModalOpen] = useState(false);

	// State for controlling the dropdown menu
	const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
	const isMenuOpen = Boolean(anchorEl);

	useLayoutEffect(() => {
		if (headerRef.current) {
			document.documentElement.style.setProperty(
				'--header-height',
				`${headerRef.current.offsetHeight}px`
			);
		}
		if (footerRef.current) {
			document.documentElement.style.setProperty(
				'--footer-height',
				`${footerRef.current.offsetHeight}px`
			);
		}
	}, []);

	const handleSessionTitleSave = (sessionTitle: string) => {
		if (headerInfo?.sessionId) {
			updateSessionTitle({ sessionId: headerInfo.sessionId, title: sessionTitle });
		}
	};

	const handleSetHeaderInfo = useCallback((info?: HeaderInfo) => {
		setHeaderInfo(info);
	}, []);

	const outletContextValue = useMemo(
		() => ({ setHeaderInfo: handleSetHeaderInfo, headerInfo }),
		[headerInfo, handleSetHeaderInfo]
	);

	const handleProfileModalOpen = () => {
		headerInfo && setHeaderInfo({ ...headerInfo, editModalOpen: true });
	};

	const goUserPage = () => {
		navigate(`/${routeConstants.USER}`);
		handleMenuClose(); // Close menu after navigation
	};

	const goMyCharacterListPage = () => {
		navigate(`/${routeConstants.CHARACTER}`, { state: { isMine: true } });
		handleMenuClose(); // Close menu after navigation
	};

	const goCharacterPage = (characterId: string) => {
		navigate(`/${routeConstants.CHARACTER}/${characterId}`);
		handleMenuClose();
	};
	// In RootLayout component
	const onLogout = async () => {
		try {
			await logout();
			const currentPath = location.pathname;
			const sessionAuthPaths = ['/character/new', '/chat', '/history/'];

			const needsRedirect = sessionAuthPaths.some((path) => {
				if (path.endsWith('/')) return currentPath.startsWith(path);

				return currentPath === path || currentPath.startsWith(path + '/');
			});

			if (needsRedirect) {
				navigate('/');
			}

			handleMenuClose();
		} catch (error) {
			console.error('Logout failed:', error);
		}
	};

	const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
		setAnchorEl(event.currentTarget);
	};

	const handleMenuClose = () => {
		setAnchorEl(null);
	};

	const handleImageModalOpen = () => {
		setImageModalOpen(true);
	};

	const handleImageModalClose = () => {
		setImageModalOpen(false);
	};

	return (
		<Box
			sx={{
				display: 'flex',
				flexDirection: 'column',

				height: '100vh',
				backgroundColor: (theme) => theme.palette.background.default,
			}}
		>
			<CssBaseline />
			<GlassAppBar sx={{ width: '100%', position: 'sticky' }} ref={headerRef}>
				<Toolbar
					sx={(theme) => ({
						justifyContent: 'space-between',
						[theme.breakpoints.down('md')]: {
							pr: 1, // bring left/right content closer
						},
					})}
				>
					<Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, overflow: 'hidden' }}>
						{!headerInfo?.mobileImageUrl && (
							<RomanticTitle
								logo
								variant="h6"
								component="div"
								onClick={() => navigate('/')}
								role="button"
								sx={{ pr: 1 }}
							>
								{APPNAME}
							</RomanticTitle>
						)}
						{headerInfo && (
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									pr: 1,
									pt: 0.5,
									pb: 0.5,
									gap: 1,
									minWidth: 0, // Prevent overflow
								}}
							>
								<Box
									role="button"
									onClick={() => goCharacterPage(headerInfo.characterId)}
									sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
								>
									<Avatar src={headerInfo.avatarUrl} variant="circular">
										<AccountCircle />
									</Avatar>
								</Box>

								{/* ✅ Responsive container for profile and session info */}
								<Box
									sx={{
										display: 'flex',
										// Stack vertically on mobile, horizontally on desktop
										flexDirection: isSmallScreen ? 'column' : 'row',
										alignItems: isSmallScreen ? 'flex-start' : 'center',
										gap: isSmallScreen ? 0.2 : 1,
										minWidth: 0, // Prevent overflow
									}}
								>
									{/* Profile name - opens modal */}
									<Typography
										variant="body2"
										fontFamily={titleFontFamily}
										role="button"
										color="secondary"
										onClick={handleProfileModalOpen}
										sx={{ '&:hover': { textDecoration: 'underline' }, whiteSpace: 'nowrap' }}
									>
										{headerInfo.profileShowName}
									</Typography>
									{headerInfo.sessionId && headerInfo.sessionTitle && (
										<InlineEditableField
											initialValue={headerInfo.sessionTitle}
											onSave={handleSessionTitleSave}
											typographyProps={{
												color: 'textPrimary',
												variant: 'caption',
												sx: { maxWidth: isSmallScreen ? '200px' : '150px' },
											}}
											textFieldProps={{ variant: 'standard', size: 'small' }}
										/>
									)}
								</Box>
							</Box>
						)}
						{!isSmallScreen && (
							<RomanticTitle
								variant="subtitle1"
								colorVariant="silver"
								component="div"
								onClick={() => navigate(`/${routeConstants.CHARACTER}`)}
								role="button"
								sx={{ px: 1 }}
							>
								{getLangText(LANG_KEYS.CHARACTERS)}
							</RomanticTitle>
						)}
					</Box>

					<Box sx={{ display: 'flex', alignItems: 'center' }}>
						{headerInfo && headerInfo.mobileImageUrl && (
							<IconButton
								onClick={handleImageModalOpen}
								aria-label="view character image"
								sx={{
									color: 'silver',
									transition: 'all 0.3s ease-in-out',
									'&:hover': { color: silver.main },
								}}
							>
								<ImageIcon />
							</IconButton>
						)}
						<LanguageSwitch />
						{/* <Switch
							checked={mode === 'dark'}
							onChange={toggleMode}
							color="default"
							size="small"
							aria-label="toggle theme"
						/> */}

						{!isSessionLoading && (
							<>
								<IconButton
									onClick={isLoggedIn ? handleMenuOpen : openLoginModal}
									aria-label={isLoggedIn ? 'account of current user' : 'login'}
									aria-controls={isMenuOpen ? 'account-menu' : undefined}
									aria-haspopup="true"
								>
									<AccountCircle
										sx={{
											color: isLoggedIn ? gold.main : 'grey',
											transition: 'all 0.3s ease-in-out',
											'&:hover': { color: gold.main, filter: `drop-shadow(0 0 6px ${gold.light})` },
										}}
									/>
								</IconButton>
								<Menu
									id="account-menu"
									anchorEl={anchorEl}
									open={isMenuOpen}
									onClose={handleMenuClose}
									onClick={handleMenuClose}
									transformOrigin={{ horizontal: 'right', vertical: 'top' }}
									anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
									disableAutoFocusItem={true} // <-- This prevents auto-focus on first item
									slotProps={{
										paper: {
											className: 'hide-scrollbar',
											sx: (theme) => {
												const styleObject = theme.palette.mode === 'dark' ? glassEffect : glassEffectLight;
												const { '&:hover': hoverStyles, ...baseStyles } = styleObject;

												return {
													...baseStyles,
													// Apply hover styles only on non-mobile devices
													[theme.breakpoints.up('md')]: { ...hoverStyles },
												};
											},
										},
										// Remove list padding on mobile
										list: { sx: (theme) => ({ [theme.breakpoints.down('md')]: { padding: 0.5 } }) },
									}}
								>
									<GlassMenuItem
										onClick={goUserPage}
										colorVariant="silver"
										sx={{ alignItems: 'center', my: 1 }}
									>
										<Avatar src={userRes?.userInfo?.avatarUrl} variant="circular" sx={{ mr: 2 }} />
										<Typography variant="subtitle1">{getLangText(LANG_KEYS.USER_INFO)}</Typography>
									</GlassMenuItem>
									<GlassMenuItem onClick={goMyCharacterListPage} colorVariant="silver">
										{getLangText(LANG_KEYS.MY_CHARACTERS)}
									</GlassMenuItem>
									<GlassMenuItem onClick={onLogout} colorVariant="silver">
										{getLangText(LANG_KEYS.LOGOUT)}
									</GlassMenuItem>
								</Menu>
							</>
						)}
					</Box>
				</Toolbar>
			</GlassAppBar>
			{/* Reload detector */}
			<ReloadToHome />

			{/* main box */}
			<Box component="main" sx={{ flex: 1, overflowY: 'auto' }}>
				<Outlet context={outletContextValue} />
			</Box>

			{/* Login Modal */}
			{!isLoggedIn && <LoginModal loginOpen={isLoginModalOpen} handleCloseLogin={closeLoginModal} />}
			{/* Image Modal */}
			<ImageModal
				open={imageModalOpen}
				onClose={handleImageModalClose}
				imageUrl={headerInfo?.mobileImageUrl}
				characterId={headerInfo?.characterId}
			/>

			{/* Footer */}
			{!isSmallScreen && (
				<GlassFooter
					ref={footerRef}
					sx={{ width: '100%', position: 'sticky', bottom: 0, zIndex: (theme) => theme.zIndex.appBar }}
				>
					<Container maxWidth="sm">
						<Typography variant="body2" color="text.secondary" align="center">
							{`Copyright © ${APPNAME} `}
							{'2025'}
							{'.'}
						</Typography>
					</Container>
				</GlassFooter>
			)}
		</Box>
	);
}
