// src/client/component/page/CharacterPage.tsx

import { Typography, Box, Container, Stack, CircularProgress } from '@mui/material'; // Import CircularProgress
import { DEFAULT_IMAGE_NUMBER } from '@shared/index.ts'; // Import default image number constant
import { CharacterPortrait } from './index.ts';
import { useCharacterApi } from '../../hook/api/useCharacterApi.ts';
import { useCharacterState } from '../../hook/state/useCharacterState.ts';

// Helper Component to manage state for a single character's portrait
const CharacterItem: React.FC<{ characterId: string; showName: string }> = ({
	characterId,
	showName,
}) => {
	// Use the hook *per character* to load its specific assets
	const { portraitMap, isLoadingPortraits, portraitError } = useCharacterState(characterId);
	console.log(characterId);
	// Get the URL for the default portrait from the map
	console.log(portraitMap);
	const defaultImageUrl = portraitMap[DEFAULT_IMAGE_NUMBER];
	console.log(defaultImageUrl);

	return (
		<Box key={characterId} sx={{ border: '1px solid grey', p: 2, mb: 2 }}>
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
				<CharacterPortrait imageUrl={defaultImageUrl} charName={showName} /> // Show portrait
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
					{/* Placeholder if no default image found */}
				</Box>
			)}
			<Typography variant="h6">{showName}</Typography>
			{/* Add navigation buttons or links here */}
		</Box>
	);
};

export const CharacterPage = () => {
	// Fetch character list metadata
	const { characters, loading: loadingList } = useCharacterApi();

	if (loadingList) {
		// Use a more descriptive loading state, maybe centered
		return (
			<Container
				sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}
			>
				<CircularProgress />
				<Typography sx={{ ml: 2 }}>Loading characters...</Typography>
			</Container>
		);
	}

	// if (listError) {
	//      return <Typography color="portraitError">Error loading character list: {listError.message}</Typography>
	// }

	if (characters.length === 0) {
		return <Typography>No characters found.</Typography>; // Handle empty state
	}

	return (
		<Container maxWidth="sm">
			<Typography variant="h4" gutterBottom>
				Select Character
			</Typography>
			<Stack spacing={2}>
				{/* Map over characters and render CharacterItem for each */}
				{characters.map(({ characterId, showName }) => (
					<CharacterItem
						key={characterId}
						characterId={characterId} // Pass the full ID (e.g., "monday-original")
						showName={showName}
					/>
				))}
			</Stack>
		</Container>
	);
};
