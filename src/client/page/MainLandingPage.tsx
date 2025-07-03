// src/client/page/MainLandingPage.tsx

import React from 'react';
import { Box, Container, Typography, Paper } from '@mui/material';

export default function MainLandingPage() {
	return (
		<Box
			sx={{
				minHeight: '100vh',
				background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'center',
				alignItems: 'center',
				py: 8,
			}}
		>
			<Container maxWidth="md">
				<Paper elevation={4} sx={{ p: { xs: 3, md: 5 }, mb: 4, background: '#fffbe6' }}>
					<Typography variant="h3" component="h1" gutterBottom align="center" fontWeight="bold">
						Welcome to Rita-Berenice
					</Typography>
				</Paper>
				<Paper elevation={2} sx={{ p: { xs: 2, md: 4 }, background: '#f9fafb' }}>
					<Typography variant="h5" component="h2" gutterBottom fontWeight="bold">
						1 Corinthians 15:29-31
					</Typography>
					<Typography variant="body1" sx={{ fontStyle: 'italic' }}>
						“Now if there is no resurrection, what will those do who are baptized for the dead? If the
						dead are not raised at all, why are people baptized for them?
						<br />
						And as for us, why do we endanger ourselves every hour? I face death every day—yes, just as
						surely as I boast about you in Christ Jesus our Lord.”
					</Typography>
				</Paper>
			</Container>
		</Box>
	);
}
