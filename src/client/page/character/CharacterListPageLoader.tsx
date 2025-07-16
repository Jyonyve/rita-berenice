// src/client/page/CharacterPage.tsx
import { CircularProgress, Container, Typography } from '@mui/material';
import { useCharacterApi } from '../../hook/api/index.js';
import { CharacterListPage } from './CharacterListPage.jsx';

export function CharacterListPageLoader() {
	const { data: characterRes, isLoading } = useCharacterApi().getAllCharacters();

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
