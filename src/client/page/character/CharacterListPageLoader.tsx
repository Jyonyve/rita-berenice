// src/client/page/CharacterPage.tsx
import { CircularProgress, Container, Typography } from '@mui/material';
import { CharacterListPage } from './CharacterListPage.jsx';
import { useCharacterApi } from '../../hook/api/index.js';

export function CharacterListPageLoader() {
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

	return <CharacterListPage characterInfos={characterRes?.characterInfos || []} />;
}
