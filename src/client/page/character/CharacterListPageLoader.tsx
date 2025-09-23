// src/client/page/CharacterPage.tsx
import { CircularProgress, Container, Typography } from '@mui/material';
import { useCharacterApi } from '../../hook/api/index.js';
import { CharacterListPage } from './CharacterListPage.jsx';
import { GlassCircularProgress } from '../../layout/glass/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { LANG_KEYS } from '#shared/config/langConstants.js';
import { useLocation } from 'react-router';
import { useAuth } from '../../provider/AuthProvider.tsx';

export function CharacterListPageLoader() {
	const { state } = useLocation();
	const { userId, isAdmin } = useAuth();
	const { getAllCharacters, getCharactersByUserId } = useCharacterApi();

	const isMine = !!state?.isMine;

	// Always call hooks in the same order
	const { data: characterRes, isLoading } =
		isMine && userId ? getCharactersByUserId(userId) : getAllCharacters();

	if (isLoading) {
		return (
			<Container
				sx={{
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
					alignItems: 'center',
					height: '80vh',
				}}
			>
				<GlassCircularProgress colorVariant="silver" />
				<Typography sx={{ mt: 2 }}>{getLangText(LANG_KEYS.LOADING_CHARACTERS)}</Typography>
			</Container>
		);
	}

	const filteredCharacter = isAdmin
		? characterRes?.characterInfos
		: characterRes?.characterInfos.filter((char) => char.userId !== 'sunfish');

	return <CharacterListPage characterInfos={filteredCharacter || []} />;
}
