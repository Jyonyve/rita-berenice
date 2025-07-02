import { Container, CircularProgress, Typography } from '@mui/material';
import { useCharacterApi, useChatApi } from '../../hook/index.js';
import CharacterPage from './CharacterPage.jsx';
import { useNavigate, useParams } from 'react-router';
import { useEffect } from 'react';

export function CharacterPageLoader() {
	const navigate = useNavigate();
	const { characterId } = useParams();

	useEffect(() => {
		if (!characterId) {
			navigate('/not-found-characterId', { replace: true });
		}
	}, [characterId, navigate]);

	if (!characterId) return;

	const { data: characterRes, isLoading, isError } = useCharacterApi().getCharacter(characterId);

	if (isLoading || !characterRes) {
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

	return (
		<CharacterPage
			characterInfo={characterRes?.characterInfo}
			onStartSession={function (characterId: string): void {
				throw new Error('Function not implemented.');
			}}
			onLoadProfile={function (profileId: string): void {
				throw new Error('Function not implemented.');
			}}
		/>
	);
}
