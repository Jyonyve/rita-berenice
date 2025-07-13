// src/client/component/page/CharacterListPage.tsx

import React, { useState } from 'react';
import { Typography, Box, CircularProgress, Grid, Theme } from '@mui/material';
import { useCharacterState } from '../../hook/state/useCharacterState.js';
import { DEFAULT_IMAGE_NUMBER } from '#shared/config/emotionWordsMapper.js';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { useNavigate } from 'react-router';
import { GlassCard, GlassPaper, GlassPortrait } from '../../layout/glass/index.js';
import { RomanticTitle } from '../../layout/RomanticTitle.jsx';
import { gold, silver } from '../../style/colors.ts';

// Helper Component: CharacterItem now uses GlassCard
const CharacterItem: React.FC<{ characterInfo: CharacterInfo }> = ({ characterInfo }) => {
	const { portraitMap, isLoadingPortraits, portraitError } = useCharacterState(
		characterInfo.characterId
	);
	const defaultImageUrl = portraitMap[DEFAULT_IMAGE_NUMBER];
	const navigate = useNavigate();
	const [isHovered, setIsHovered] = useState(false);

	const handleCharacterPage = () => {
		navigate(`${characterInfo.characterId}`);
	};
	const characterCardSx = {
		height: '100%',
		display: 'flex',
		flexDirection: 'column',
		p: 1,
		position: 'relative',
		zIndex: 1,
		'&:hover': {
			zIndex: 2, // Lifts card to prevent glow clipping, but no shadow on the card itself.
			'& .character-showname': { textShadow: `0 0 8px ${gold.main}`, transition: 'text-shadow 0.5s' },
		},
	};

	return (
		<GlassCard
			sx={characterCardSx}
			role="button"
			onClick={handleCharacterPage}
			// Add event handlers to update the hover state.
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<Box sx={{ width: '100%', display: 'flex', mb: 1 }}>
				{isLoadingPortraits ? (
					<CircularProgress size={24} />
				) : defaultImageUrl ? (
					<GlassPortrait
						imageUrl={defaultImageUrl}
						className="character-portrait"
						// Pass the hover state down to the portrait component.
						forceGlow={isHovered}
					/>
				) : (
					<Typography variant="caption" color="textSecondary">
						No Image
					</Typography>
				)}
			</Box>
			<Box sx={{ mt: 'auto' }}>
				<RomanticTitle noGlow className="character-showname" variant="h6" noWrap color="gold">
					{characterInfo.showName}
				</RomanticTitle>
				<Typography variant="body2" noWrap>
					{characterInfo.title}
				</Typography>
			</Box>
		</GlassCard>
	);
};

// Main Component: Already uses GlassPaper, no change needed here.
export const CharacterListPage = ({ characterInfos }: { characterInfos: CharacterInfo[] }) => {
	if (characterInfos.length === 0) {
		return <Typography>No characters found.</Typography>;
	}

	return (
		<GlassPaper className="paper" sx={{ p: 2, overflowY: 'auto' }}>
			<Grid container spacing={2}>
				{characterInfos.map((characterInfo) => (
					<Grid key={characterInfo.characterId} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
						<CharacterItem characterInfo={characterInfo} />
					</Grid>
				))}
			</Grid>
		</GlassPaper>
	);
};
