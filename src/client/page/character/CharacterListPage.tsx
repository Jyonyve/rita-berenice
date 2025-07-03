// src/client/component/page/CharacterPage.tsx

import { Typography, Box, Container, Stack, CircularProgress } from '@mui/material'; // Import CircularProgress

import { useCharacterState } from '../../hook/state/useCharacterState.js';
import { DEFAULT_IMAGE_NUMBER } from '#shared/config/emotionWordsMapper.js';
import { CharacterPortrait } from './CharacterPortrait.jsx';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { useNavigate } from 'react-router';
import { routeConstants } from '../../routeConstants.js';

// Helper Component to manage state for a single character's portrait
const CharacterItem: React.FC<{ characterInfo: CharacterInfo }> = ({ characterInfo }) => {
	// Use the hook *per character* to load its specific assets
	const { portraitMap, isLoadingPortraits, portraitError } = useCharacterState(
		characterInfo.characterId
	);
	const defaultImageUrl = portraitMap[DEFAULT_IMAGE_NUMBER];
	const navigate = useNavigate();

	const handleCharacterPage = () => {
		navigate(`${routeConstants.CHARACTER}/${characterInfo.characterId}`);
	};

	return (
		<Box sx={{ border: '1px solid grey', p: 2, mb: 2 }}>
			{/* Conditionally render portrait based on loading/portraitError/success */}
			{isLoadingPortraits ? (
				<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 100 }}>
					<CircularProgress size={24} /> {/* Show loading spinner */}
				</Box>
			) : portraitError ? (
				<Typography color="portraitError" variant="caption">
					Image Error
				</Typography> // Show portraitError
			) : defaultImageUrl ? (
				<CharacterPortrait
					imageUrl={defaultImageUrl}
					characterInfo={characterInfo}
					handleClick={handleCharacterPage}
				/> // Show portrait
			) : (
				<Box
					sx={{
						height: 100,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						bgcolor: 'grey.200',
					}}
				>
					<Typography variant="caption" color="textSecondary">
						No Image
					</Typography>
				</Box>
			)}
			<Typography variant="h6">{characterInfo.showName}</Typography>
			<Typography>{characterInfo.title}</Typography>
		</Box>
	);
};

export const CharacterListPage = ({ characterInfos }: { characterInfos: CharacterInfo[] }) => {
	if (characterInfos.length === 0) {
		return <Typography>No characters found.</Typography>; // Handle empty state
	}

	return (
		<Container maxWidth="sm">
			<Typography variant="h4" gutterBottom>
				Select Character
			</Typography>
			<Stack spacing={2}>
				{/* Map over characters and render CharacterItem for each */}
				{characterInfos.map((characterInfo) => (
					<CharacterItem key={characterInfo.characterId} characterInfo={characterInfo} />
				))}
			</Stack>
		</Container>
	);
};
