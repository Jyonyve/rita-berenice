import React, { FC, useEffect } from 'react';
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
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import { AuthPage } from 'supertokens-auth-react/ui/index.js';
import { signOut, useSessionContext } from 'supertokens-auth-react/recipe/session/index.js';
import { APPNAME } from '#shared/config/constants.js';
import { routeConstants } from '../routeConstants.js';
import { useAuthModal } from '../provider/AuthModalProvider.jsx';
import { GlassPaper } from './GlassPaper.jsx';
import { GlassAppBar } from './GlassAppBar.jsx';
import { GlassFooter } from './GlassFooter.jsx';
import { GlassBox } from './GlassBox.jsx';

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

	useEffect(() => {
		if (!session.loading && session.doesSessionExist && isLoginModalOpen) {
			closeLoginModal();
		}
	}, [session, isLoginModalOpen, closeLoginModal, mode]);

	const goCharacterPage = () => {
		navigate(`/${routeConstants.CHARACTER}`);
	};

	const onLogout = async () => {
		await signOut();
		window.location.href = '/';
	};

	return (
		<Box
			sx={{
				display: 'flex',
				flexDirection: 'column',
				minHeight: '100vh',
				backgroundColor: (theme) => theme.palette.background.default,
				// backgroundImage: `url('/path/to/your/image.png')`,
				// backgroundSize: 'cover',
				// backgroundAttachment: 'fixed',
			}}
		>
			<CssBaseline />
			<GlassAppBar position="sticky">
				<Toolbar>
					<Typography
						variant="h6"
						component="div"
						sx={{ flexGrow: 1, cursor: 'pointer' }}
						onClick={goCharacterPage}
						role="button"
					>
						{APPNAME}
					</Typography>
					<Switch
						checked={mode === 'dark'}
						onChange={toggleMode}
						color="default"
						size="small"
						aria-label="toggle theme"
					/>
					{!session.loading && (
						<>
							{session.doesSessionExist ? (
								<>
									<Typography variant="body2" sx={{ mx: 2 }}>
										User: {session.userId}
									</Typography>
									<IconButton color="inherit" onClick={onLogout} aria-label="logout">
										<LogoutIcon />
									</IconButton>
								</>
							) : (
								<IconButton color="inherit" onClick={openLoginModal} aria-label="login">
									<LoginIcon />
								</IconButton>
							)}
						</>
					)}
				</Toolbar>
			</GlassAppBar>
			{/* Main Content Area */}
			<Box component="main" sx={{ flex: 1, overflowY: 'auto', p: { xs: 1, md: 2 } }}>
				<Outlet />
			</Box>
			{/* Login Modal */}
			{!session.loading && !session.doesSessionExist && (
				<LoginModal loginOpen={isLoginModalOpen} handleCloseLogin={closeLoginModal} />
			)}
			<GlassFooter sx={{ position: 'sticky', bottom: 0, zIndex: (theme) => theme.zIndex.appBar }}>
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
