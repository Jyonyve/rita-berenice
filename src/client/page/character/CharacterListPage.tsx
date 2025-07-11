// src/client/component/page/CharacterListPage.tsx

import React from 'react';
import { Typography, Box, CircularProgress, Grid } from '@mui/material';
import { useCharacterState } from '../../hook/state/useCharacterState.js';
import { DEFAULT_IMAGE_NUMBER } from '#shared/config/emotionWordsMapper.js';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { useNavigate } from 'react-router';
import { GlassCard, GlassPaper, GlassPortrait } from '../../layout/glass/index.js';

// Helper Component: CharacterItem now uses GlassCard
const CharacterItem: React.FC<{ characterInfo: CharacterInfo }> = ({ characterInfo }) => {
	const { portraitMap, isLoadingPortraits, portraitError } = useCharacterState(
		characterInfo.characterId
	);
	const defaultImageUrl = portraitMap[DEFAULT_IMAGE_NUMBER];
	const navigate = useNavigate();

	const handleCharacterPage = () => {
		navigate(`${characterInfo.characterId}`);
	};

	return (
		<GlassCard
			sx={{
				height: '100%', // Make card fill the grid item height
				display: 'flex',
				flexDirection: 'column',
				p: 1, // Add padding inside the card
			}}
			role="button"
			onClick={handleCharacterPage}
		>
			<Box
				sx={{
					width: '100%',
					aspectRatio: '1 / 1.2',
					backgroundColor: 'rgba(0,0,0,0.2)', // Darker background for contrast
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					overflow: 'hidden',
					mb: 1,
					borderRadius: 1, // Rounded corners for the image container
				}}
			>
				{isLoadingPortraits ? (
					<CircularProgress size={24} />
				) : portraitError ? (
					<Typography color="error" variant="caption">
						Error
					</Typography>
				) : defaultImageUrl ? (
					<GlassPortrait imageUrl={defaultImageUrl} />
				) : (
					<Typography variant="caption" color="textSecondary">
						No Image
					</Typography>
				)}
			</Box>
			<Box sx={{ mt: 'auto' }}>
				<Typography variant="subtitle1" noWrap color="primary">
					{characterInfo.showName}
				</Typography>
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
