// src/client/page/CharacterPage.tsx
import { CircularProgress, Container, Typography } from '@mui/material';
import { useCharacterApi } from '../../hook/api/index.js';
import { CharacterListPage } from './CharacterListPage.jsx';
import { GlassCircularProgress } from '../../layout/glass/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { LANG_KEYS } from '#shared/config/langConstants.js';

export function CharacterListPageLoader() {
	const { data: characterRes, isLoading } = useCharacterApi().getAllCharacters();

	if (isLoading) {
		// Use a more descriptive loading state, maybe centered
		return (
			<Container
				sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}
			>
				<GlassCircularProgress colorVariant="silver" />
				<Typography sx={{ ml: 2 }}>{getLangText(LANG_KEYS.LOADING_CHARACTERS)}</Typography>
			</Container>
		);
	}

	return <CharacterListPage characterInfos={characterRes?.characterInfos || []} />;
}
