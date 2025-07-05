import { Container, CircularProgress, Typography } from '@mui/material';
import { useCharacterApi, useChatApi } from '../../hook/index.js';
import CharacterPage from './CharacterPage.jsx';
import { useNavigate, useParams } from 'react-router';
import { useEffect } from 'react';
import { useUserApi } from '../../hook/api/useUserApi.js';
import { useSessionContext } from 'supertokens-auth-react/recipe/session/index.js';

export function CharacterPageLoader() {
	const navigate = useNavigate();
	const { characterId } = useParams();
	const session = useSessionContext();

	useEffect(() => {
		if (!characterId) {
			navigate('/not-found-characterId', { replace: true });
		}
	}, [characterId, navigate]);

	if (!characterId) return;

	const { data: characterRes, isLoading, isError } = useCharacterApi().getCharacter(characterId);
	const { data: userRes } = useUserApi().getUser(session.loading ? '' : session.userId);

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

	return <CharacterPage characterInfo={characterRes?.characterInfo} userInfo={userRes?.userInfo} />;
}
