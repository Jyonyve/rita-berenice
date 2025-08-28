import React, { FC, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { signOut } from 'supertokens-auth-react/recipe/session/index.js';
import { APPNAME } from '#shared/config/constants.js';

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

interface HeaderInfo {
	characterId: string;
	showName: string;
	avatarUrl?: string;
	mobileImageUrl?: string;
}
export type HeaderContextType = (info?: HeaderInfo) => void;

export function RootLayout() {
	const { mode, toggleMode } = useColorMode();
	const isSmallScreen = useMediaQuery((theme) => theme.breakpoints.down('md'));
	const navigate = useNavigate();
	const { isSessionLoading, isLoggedIn, isLoginModalOpen, openLoginModal, closeLoginModal } =
		useAuth();

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

	const goCharacterListPage = () => {
		navigate(`/${routeConstants.CHARACTER}`);
		handleMenuClose(); // Close menu after navigation
	};

	const goCharacterPage = (characterId: string) => {
		navigate(`/${routeConstants.CHARACTER}/${characterId}`);
	};

	const onLogout = async () => {
		await signOut();
		navigate('/');
		handleMenuClose(); // Close menu after logout
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
					<Box sx={{ display: 'flex', alignItems: 'center' }}>
						{!headerInfo?.mobileImageUrl && (
							<RomanticTitle
								logo
								variant="h6"
								component="div"
								onClick={() => navigate('/')}
								role="button"
								sx={{ paddingRight: 2 }}
							>
								{APPNAME}
							</RomanticTitle>
						)}
						{headerInfo && (
							<Box
								role="button"
								sx={{ display: 'flex', alignItems: 'center', pr: 1, pt: 0.5, pb: 0.5 }}
								gap={1}
								onClick={() => goCharacterPage(headerInfo.characterId)}
							>
								<Avatar src={headerInfo.avatarUrl} variant="circular">
									<AccountCircle />
								</Avatar>
								<Typography variant="caption">{headerInfo.showName}</Typography>
							</Box>
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
						<Switch
							checked={mode === 'dark'}
							onChange={toggleMode}
							color="default"
							size="small"
							aria-label="toggle theme"
						/>

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
									<GlassMenuItem onClick={goCharacterListPage} colorVariant="silver">
										{getLangText(LANG_KEYS.CHARACTERS)}
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

			{/* main box */}
			<Box component="main" sx={{ flex: 1, overflowY: 'auto' }}>
				<Outlet context={setHeaderInfo satisfies HeaderContextType} />
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
