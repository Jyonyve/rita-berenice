// src/client/layout/RootLayout.tsx
import React from 'react';
import { Outlet } from 'react-router';
import { AppBar, Box, Container, Toolbar, Typography, CssBaseline } from '@mui/material';

/**
 * The root layout for the application.
 * It includes a persistent header and a main content area where
 * child routes will be rendered via the <Outlet /> component.
 */
export function RootLayout() {
	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
			<CssBaseline />
			{/* Header */}
			<AppBar position="static">
				<Toolbar>
					<Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
						Rita-Berenice
					</Typography>
				</Toolbar>
			</AppBar>

			{/* Main Content Area */}
			<Container component="main" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
				{/* Child routes are rendered here */}
				<Outlet />
			</Container>

			{/* Footer */}
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
