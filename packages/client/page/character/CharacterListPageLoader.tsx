// src/client/page/CharacterPage.tsx
import { CircularProgress, Container, Typography } from '@mui/material';
import { useCharacterApi } from '../../hook/api/index.js';
import { CharacterListPage } from './CharacterListPage.jsx';
import { GlassCircularProgress } from '../../layout/component/glass/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { useLocation } from 'react-router';
import { useAuth } from '../../provider/AuthProvider.tsx';
import { CHARACTER_VISIBILITY, LANG_KEYS } from '@rita-berenice/shared/config';

export function CharacterListPageLoader() {
	const { state } = useLocation();
	const { userId } = useAuth();
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

	// Defense-in-depth alongside server-side filtering: hide 'private' characters
	// that the current user does not own.
	const filteredCharacter = characterRes?.characterInfos.filter(
		(char) => char.userId === userId || char.visibility !== CHARACTER_VISIBILITY.PRIVATE
	);

	return (
		<CharacterListPage
			characterInfos={filteredCharacter || []}
			characterPortraits={characterRes?.characterPortraits ?? {}}
		/>
	);
}
