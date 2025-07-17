// src/client/component/page/CharacterListPage.tsx

import React, { useState } from 'react';
import { Typography, Box, CircularProgress, Grid, Theme } from '@mui/material';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { useNavigate } from 'react-router';
import { GlassCard, GlassPaper, GlassPortrait } from '../../layout/glass/index.js';
import { HoverBox, RomanticTitle } from '../../layout/index.js';
import { containerSpacing } from '../../style/index.js';
import { getDefaultImage } from '../../util/portraitUtils.js';

// Helper Component: CharacterItem now uses GlassCard
const CharacterItem: React.FC<{ characterInfo: CharacterInfo }> = ({ characterInfo }) => {
	const navigate = useNavigate();
	const defaultImage = getDefaultImage(characterInfo.characterId);
	const handleCharacterPage = () => {
		navigate(`${characterInfo.characterId}`);
	};
	const characterCardSx = {
		display: 'flex',
		flexDirection: 'column',
		position: 'relative',
		zIndex: 1,
		'&:hover': {
			zIndex: 2, // Lifts card to prevent glow clipping, but no shadow on the card itself.
		},
	};

	const contentSx = {
		height: '100%',
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'space-between',
		'&:last-child': { pb: 1 }, // Override MUI's default bottom padding
	};

	return (
		<GlassCard
			sx={characterCardSx}
			role="button"
			onClick={handleCharacterPage}
			contentProps={{ sx: contentSx }}
		>
			<HoverBox sx={{ width: '100%', display: 'flex', mb: 1 }}>
				{defaultImage ? (
					<GlassPortrait imageUrl={defaultImage} />
				) : (
					<Typography variant="caption" color="textSecondary">
						No Image
					</Typography>
				)}
			</HoverBox>
			<HoverBox sx={{ mt: 'auto' }}>
				<RomanticTitle
					noGlow // Disable the title's own hover effect
					variant="h6"
					color="gold"
					colorVariant="gold" // Ensures the glow color is gold
				>
					{characterInfo.showName}
				</RomanticTitle>
				<Typography variant="body2" noWrap>
					{characterInfo.title}
				</Typography>
			</HoverBox>
		</GlassCard>
	);
};

// Main Component: Already uses GlassPaper, no change needed here.
export const CharacterListPage = ({ characterInfos }: { characterInfos: CharacterInfo[] }) => {
	if (characterInfos.length === 0) {
		return <Typography>No characters found.</Typography>;
	}

	return (
		<GlassPaper key="character-list-page" className="paper" sx={{ overflowY: 'auto' }}>
			<Grid container spacing={containerSpacing}>
				{characterInfos.map((characterInfo) => (
					<Grid key={characterInfo.characterId} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
						<CharacterItem characterInfo={characterInfo} />
					</Grid>
				))}
			</Grid>
		</GlassPaper>
	);
};
