// src/client/component/page/CharacterPage.tsx

import { Typography, Box, Container, Stack, CircularProgress, Grid } from '@mui/material'; // Import CircularProgress

import { useCharacterState } from '../../hook/state/useCharacterState.js';
import { DEFAULT_IMAGE_NUMBER } from '#shared/config/emotionWordsMapper.js';
import { CharacterPortrait } from './CharacterPortrait.jsx';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { useNavigate } from 'react-router';
import { routeConstants } from '../../routeConstants.js';

// Helper Component to manage state for a single character's portrait
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
		<Box
			sx={{
				display: 'flex',
				flexDirection: 'column',
				border: '1px solid #ddd',
				p: 1,
				cursor: 'pointer',
				'&:hover': { borderColor: 'primary.main', boxShadow: 3 },
				height: '100%', // Make box fill the grid item height
			}}
			onClick={handleCharacterPage}
		>
			<Box
				sx={{
					// This box will act as the container for the image
					width: '100%',
					// Use aspect-ratio to maintain a consistent shape for all image containers
					aspectRatio: '1 / 1.2', // A slightly portrait orientation
					backgroundColor: 'grey.200',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					overflow: 'hidden', // Ensures parts of the image outside the box are hidden
					mb: 1, // Margin bottom for spacing
				}}
			>
				{isLoadingPortraits ? (
					<CircularProgress size={24} />
				) : portraitError ? (
					<Typography color="error" variant="caption">
						Error
					</Typography>
				) : defaultImageUrl ? (
					// The CharacterPortrait component should handle the <img> tag
					// Make sure its internal <img> has the `object-fit` style
					<CharacterPortrait imageUrl={defaultImageUrl} />
				) : (
					<Typography variant="caption" color="textSecondary">
						No Image
					</Typography>
				)}
			</Box>
			{/* Text content aligned at the bottom */}
			<Box sx={{ mt: 'auto' }}>
				<Typography variant="h6" noWrap>
					{characterInfo.showName}
				</Typography>
				<Typography noWrap>{characterInfo.title}</Typography>
			</Box>
		</Box>
	);
};

export const CharacterListPage = ({ characterInfos }: { characterInfos: CharacterInfo[] }) => {
	if (characterInfos.length === 0) {
		return <Typography>No characters found.</Typography>; // Handle empty state
	}

	return (
		// 3. Use a wider container to fit more items
		<Container maxWidth="lg">
			<Typography variant="h4" gutterBottom>
				Select Character
			</Typography>
			{/* 4. Replace Stack with a responsive Grid */}
			<Grid container spacing={2}>
				{characterInfos.map((characterInfo) => (
					// Define column widths for different screen sizes
					<Grid key={characterInfo.characterId} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
						<CharacterItem characterInfo={characterInfo} />
					</Grid>
				))}
			</Grid>
		</Container>
	);
};
