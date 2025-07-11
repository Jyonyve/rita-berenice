// src/client/page/MainLandingPage.tsx

import React, { Fragment } from 'react';
import { Box, Container, Typography, Paper } from '@mui/material';
import { useNavigate } from 'react-router';
import { routeConstants } from '../routeConstants.js';
import { APPNAME } from '#shared/config/constants.js';
import { RomanticTitle } from '../layout/RomanticTitle.jsx';
import { GlassBox, GlassPaper } from '../layout/glass/index.js';

export default function MainLandingPage() {
	const navigate = useNavigate();
	const goCharacterPage = () => {
		navigate(routeConstants.CHARACTER);
	};

	return (
		<Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
			<GlassPaper
				className="paper"
				sx={{
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
					alignItems: 'center',
				}}
			>
				<Container maxWidth="md">
					{/* 1. This box is now a flex container to perfectly center the title */}
					<GlassBox
						onClick={goCharacterPage}
						sx={{
							p: { xs: 3, md: 6 },
							mb: 4,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
						role="button"
					>
						<RomanticTitle logo variant="h2" component="h1">
							{APPNAME}
						</RomanticTitle>
					</GlassBox>

					<GlassBox sx={{ p: { xs: 2, md: 4 } }}>
						<Typography variant="h6" component="h2" gutterBottom fontFamily={'Ipanema Secco'}>
							1 Corinthians 15:29-31
						</Typography>
						<Typography
							variant="body2"
							sx={{ fontFamily: 'Ipanema Secco', fontStyle: 'italic', lineHeight: 1.7 }}
						>
							“Now if there is no resurrection, what will those do who are baptized for the dead? If the
							dead are not raised at all, why are people baptized for them? And as for us, why do we
							endanger ourselves every hour? I face death every day—yes, just as surely as I boast about
							you in Christ Jesus our Lord.”
						</Typography>
					</GlassBox>
				</Container>
			</GlassPaper>
		</Box>
	);
}
