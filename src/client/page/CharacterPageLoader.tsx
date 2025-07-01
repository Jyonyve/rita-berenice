// src/client/page/CharacterPage.tsx
import { CircularProgress, Container, Typography } from '@mui/material';
import { CharacterPage } from './character/CharacterPage.jsx';
import { useCharacterApi } from '../hook/api/useCharacterApi.js';

export function CharacterPageLoader() {
	const { data: characterRes, isLoading, isError } = useCharacterApi().getAllCharacters();

	if (isLoading) {
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

	return <CharacterPage characterInfos={characterRes?.characterInfos || []} />;
}
