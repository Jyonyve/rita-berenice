import React, { FC, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
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
} from '@mui/material';
import { useColorMode } from '../provider/ColorModeProvider.jsx';
import { EmailPasswordPreBuiltUI } from 'supertokens-auth-react/recipe/emailpassword/prebuiltui.js';
import AccountCircle from '@mui/icons-material/AccountCircle';
import { AuthPage } from 'supertokens-auth-react/ui/index.js';
import { signOut } from 'supertokens-auth-react/recipe/session/index.js';
import { APPNAME } from '#shared/config/constants.js';

import { GlassPaper, GlassAppBar, GlassFooter, GlassMenuItem } from './glass/index.js';
import { RomanticTitle } from './RomanticTitle.jsx';
import { gold } from '../style/colors.js';
import { routeConstants } from '../routeConstants.js';
import { glassEffect, glassEffectLight } from '../style/glassEffect.js';
import { getLangText } from '../util/translateUtils.js';
import { LANG_KEYS } from '#shared/config/langConstants.js';
import { useAuth } from '../provider/AuthProvider.jsx';

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

export function RootLayout() {
	const { mode, toggleMode } = useColorMode();
	const navigate = useNavigate();
	const { isSessionLoading, isLoggedIn, isLoginModalOpen, openLoginModal, closeLoginModal } =
		useAuth();

	const headerRef = useRef<HTMLElement>(null);
	const footerRef = useRef<HTMLElement>(null);

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

	const goCharacterPage = () => {
		navigate(`/${routeConstants.CHARACTER}`);
		handleMenuClose(); // Close menu after navigation
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

			<GlassAppBar position="sticky" ref={headerRef}>
				<Toolbar sx={{ justifyContent: 'space-between' }}>
					<RomanticTitle
						logo
						variant="h6"
						component="div"
						onClick={() => navigate('/')}
						role="button"
						sx={{ cursor: 'pointer' }}
					>
						{APPNAME}
					</RomanticTitle>

					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
											color: isLoggedIn ? gold.main : 'grey.500',
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
									// Apply the permanent "hovered" glass style to the menu's background
									slotProps={{
										paper: {
											className: 'hide-scrollbar',
											sx: (theme) => {
												const styleObject = theme.palette.mode === 'dark' ? glassEffect : glassEffectLight;
												const { '&:hover': hoverStyles, ...baseStyles } = styleObject;
												return { ...baseStyles, ...hoverStyles };
											},
										},
									}}
								>
									<GlassMenuItem onClick={goCharacterPage} colorVariant="silver">
										{getLangText(LANG_KEYS.CHARACTERS)}
									</GlassMenuItem>

									{/* Custom glow using the colorVariant prop */}
									<GlassMenuItem onClick={onLogout} colorVariant="silver">
										{getLangText(LANG_KEYS.LOGOUT)}
									</GlassMenuItem>
								</Menu>
							</>
						)}
					</Box>
				</Toolbar>
			</GlassAppBar>
			<Box component="main" sx={{ flex: 1, overflowY: 'auto' }}>
				<Outlet />
			</Box>
			{!isLoggedIn && <LoginModal loginOpen={isLoginModalOpen} handleCloseLogin={closeLoginModal} />}
			<GlassFooter
				ref={footerRef}
				sx={{ position: 'sticky', bottom: 0, zIndex: (theme) => theme.zIndex.appBar }}
			>
				<Container maxWidth="sm">
					<Typography variant="body2" color="text.secondary" align="center">
						{`Copyright © ${APPNAME} `}
						{new Date().getFullYear()}
						{'.'}
					</Typography>
				</Container>
			</GlassFooter>
		</Box>
	);
}
