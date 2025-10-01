// src/client/page/MainLandingPage.tsx

import React, { Fragment } from 'react';
import { Box, Container, Typography, useTheme } from '@mui/material';
import { useNavigate } from 'react-router';
import { routeConstants } from '../routeConstants.js';
import { APPNAME } from '@rita-berenice/shared/config/constants.js';
import { RomanticTitle } from '../layout/RomanticTitle.jsx';
import { GlassBox, GlassPaper } from '../layout/glass/index.js';

export function MainLandingPage() {
	const navigate = useNavigate();
	const theme = useTheme();
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
							cursor: 'pointer',
							// 1. Establish this box as a size-based container for its children.
							// This allows child elements to query its dimensions.
							containerType: 'inline-size',
						}}
						role="button"
					>
						<RomanticTitle
							logo
							// The variant is still 'h2' for semantic correctness,
							// but the font size is now controlled by the sx prop for dynamic sizing.
							variant="h2"
							component="h1"
							sx={{ fontSize: `clamp(1.5rem, 8vw, ${theme.typography.h2.fontSize})` }}
						>
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
