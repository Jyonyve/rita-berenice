import React, { FC, useEffect, useLayoutEffect, useRef } from 'react';
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
} from '@mui/material';
import { useColorMode } from '../provider/ColorModeProvider.jsx';
import { EmailPasswordPreBuiltUI } from 'supertokens-auth-react/recipe/emailpassword/prebuiltui.js';
import AccountCircle from '@mui/icons-material/AccountCircle'; // Import the new icon
import { AuthPage } from 'supertokens-auth-react/ui/index.js';
import { signOut, useSessionContext } from 'supertokens-auth-react/recipe/session/index.js';
import { APPNAME } from '#shared/config/constants.js';
import { useAuthModal } from '../provider/AuthModalProvider.jsx';
import { GlassPaper, GlassAppBar, GlassFooter, GlassMetallicButton } from './glass/index.js';
import { RomanticTitle } from './RomanticTitle.jsx';
import { SolidMetallicButton } from './SolidMetallicButton.jsx';
import { gold } from '../style/colors.js';
import { GlassMetallicIconButton } from './glass/GlassMetallicIconButton.jsx';
import { mainPadding } from '../style/padding.js';

interface LoginModalProps {
	loginOpen: boolean;
	handleCloseLogin: () => void;
}
const LoginModal: FC<LoginModalProps> = ({ loginOpen, handleCloseLogin }) => (
	<Modal
		open={loginOpen}
		onClose={handleCloseLogin} // This still handles the 'Escape' key for accessibility
		disableScrollLock={true} // FIX #1: Allows the background page to be scrolled
		aria-labelledby="login-modal-title"
	>
		<GlassPaper
			onClick={handleCloseLogin} // FIX #2: Makes the entire glass surface a close button
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
	const session = useSessionContext();
	const navigate = useNavigate();
	const { isLoginModalOpen, openLoginModal, closeLoginModal } = useAuthModal();
	const headerRef = useRef<HTMLElement>(null);
	const footerRef = useRef<HTMLElement>(null);

	// --- Step 2: Measure heights and set CSS variables ---
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

	useEffect(() => {
		if (!session.loading && session.doesSessionExist && isLoginModalOpen) {
			closeLoginModal();
		}
	}, [session, isLoginModalOpen, closeLoginModal, mode]);

	const goCharacterPage = () => {
		navigate('/');
	};

	const onLogout = async () => {
		await signOut();
		navigate('/');
	};

	return (
		<Box
			sx={{
				display: 'flex',
				flexDirection: 'column',
				height: '100vh',
				backgroundColor: (theme) => theme.palette.background.default,
				// backgroundImage: `url('/path/to/your/image.png')`,
				// backgroundSize: 'cover',
				// backgroundAttachment: 'fixed',
			}}
		>
			<CssBaseline />

			<GlassAppBar position="sticky" ref={headerRef}>
				<Toolbar sx={{ justifyContent: 'space-between' }}>
					{/* Left side of the AppBar */}
					<RomanticTitle
						logo
						variant="h6"
						component="div"
						onClick={goCharacterPage}
						role="button"
						sx={{ cursor: 'pointer' }} // The cursor is now on the sx prop
					>
						{APPNAME}
					</RomanticTitle>

					{/* Right side of the AppBar, grouped in a Box */}
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
						<Switch
							checked={mode === 'dark'}
							onChange={toggleMode}
							color="default"
							size="small"
							aria-label="toggle theme"
						/>

						{!session.loading && (
							<IconButton
								onClick={session.doesSessionExist ? onLogout : openLoginModal}
								aria-label={session.doesSessionExist ? 'logout' : 'login'}
							>
								<AccountCircle
									sx={{
										// 1. Icon color is dynamic
										color: session.doesSessionExist ? gold.main : 'grey.500',
										transition: 'all 0.5s ease-in-out',
										'&:hover': {
											color: gold.main, // Always turns gold on hover
											filter: `drop-shadow(0 0 8px ${gold.light})`,
										},
									}}
								/>
							</IconButton>
						)}
					</Box>
				</Toolbar>
			</GlassAppBar>
			{/* Main Content Area */}
			<Box component="main" sx={{ flex: 1, overflowY: 'auto', p: mainPadding }}>
				<Outlet />
			</Box>
			{/* Login Modal */}
			{!session.loading && !session.doesSessionExist && (
				<LoginModal loginOpen={isLoginModalOpen} handleCloseLogin={closeLoginModal} />
			)}

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
