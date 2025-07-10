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
	Paper,
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

interface LoginModalProps {
	loginOpen: boolean;
	handleCloseLogin: () => void;
}

const LoginModal: FC<LoginModalProps> = ({ loginOpen, handleCloseLogin }) => (
	<Modal open={loginOpen} onClose={handleCloseLogin} aria-labelledby="login-modal-title">
		<Box
			sx={{
				position: 'absolute',
				top: '50%',
				left: '50%',
				transform: 'translate(-50%, -50%)',
				minWidth: 320,
				bgcolor: 'background.paper',
				boxShadow: 24,
				borderRadius: 2,
				p: 2,
			}}
		>
			<Paper sx={{ p: 2 }}>
				<AuthPage preBuiltUIList={[EmailPasswordPreBuiltUI]} />
			</Paper>
		</Box>
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
				width: '100vw',
				boxSizing: 'border-box',
				backgroundColor: (theme) => theme.palette.background.default,
			}}
		>
			<CssBaseline />
			<AppBar position="static" color="primary" elevation={1}>
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
			</AppBar>
			{/* Main Content Area */}
			<Box
				component="main"
				sx={{
					flex: 1, // Let this area grow to fill available space
					display: 'flex',
					flexDirection: 'column', // Stack content vertically
					alignItems: 'center', // Center content horizontally
					justifyContent: 'center', // Center content vertically
					p: 2, // Add some padding around the content area
					overflow: 'hidden', // Hide any potential overflow
				}}
			>
				<Outlet />
			</Box>
			{/* Login Modal */}
			{!session.loading && !session.doesSessionExist && (
				<LoginModal loginOpen={isLoginModalOpen} handleCloseLogin={closeLoginModal} />
			)}
			<Box
				component="footer"
				sx={{
					py: 2,
					px: 2,
					mt: 'auto',
					backgroundColor: (theme) =>
						theme.palette.mode === 'light' ? theme.palette.grey[200] : theme.palette.grey[800],
				}}
			>
				<Container maxWidth="sm">
					<Typography variant="body2" color="text.secondary" align="center">
						{`Copyright © ${APPNAME} `}
						{new Date().getFullYear()}
						{'.'}
					</Typography>
				</Container>
			</Box>
		</Box>
	);
}
