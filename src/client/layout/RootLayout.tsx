import React, { FC, useState, useEffect } from 'react';
import { Outlet } from 'react-router';
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
import { useColorMode } from '../style/ColorModeContext.jsx';
import { EmailPasswordPreBuiltUI } from 'supertokens-auth-react/recipe/emailpassword/prebuiltui.js';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import { AuthPage } from 'supertokens-auth-react/ui/index.js';
import { signOut, useSessionContext } from 'supertokens-auth-react/recipe/session/index.js';
import Session from 'supertokens-auth-react/lib/build/recipe/session/recipe.js';

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
	const [loginOpen, setLoginOpen] = useState(false);

	// Automatically close modal when login succeeds
	useEffect(() => {
		if (!session.loading && session.doesSessionExist && loginOpen) {
			setLoginOpen(false);
		}
	}, [session, loginOpen, mode]);

	const handleLoginModal = () => setLoginOpen(true);
	const handleCloseLogin = () => setLoginOpen(false);

	const onLogout = async () => {
		await signOut();
		window.location.href = '/';
	};
	console.log(mode);
	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
			<CssBaseline />
			<AppBar position="static">
				<Toolbar>
					<Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
						Rita-Berenice
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
								<IconButton color="inherit" onClick={handleLoginModal} aria-label="login">
									<LoginIcon />
								</IconButton>
							)}
						</>
					)}
				</Toolbar>
			</AppBar>
			<Container component="main" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
				<Outlet />
			</Container>
			{/* Only render the modal if not logged in */}
			{!session.loading && !session.doesSessionExist && (
				<LoginModal loginOpen={loginOpen} handleCloseLogin={handleCloseLogin} />
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
						{'Copyright © Rita-Berenice '}
						{new Date().getFullYear()}
						{'.'}
					</Typography>
				</Container>
			</Box>
		</Box>
	);
}
