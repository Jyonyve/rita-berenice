import { CircularProgress, Container, Typography } from '@mui/material';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCharacterApi } from '../../hook/index.js';
import { useAuth } from '../../provider/index.js';
import CharacterPage from './CharacterPage.jsx';
import { GlassCircularProgress } from '../../layout/glass/index.js';

export function CharacterPageLoader() {
	const navigate = useNavigate();
	const { characterId } = useParams();
	const { userId } = useAuth();

	useEffect(() => {
		if (!characterId) {
			navigate('/not-found-characterId', { replace: true });
		}
	}, [characterId, navigate]);

	if (!characterId) return;

	const { data: characterRes, isLoading } = useCharacterApi().getCharacter(characterId);

	if (isLoading || !characterRes) {
		// Use a more descriptive loading state, maybe centered
		return (
			<Container
				sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}
			>
				<GlassCircularProgress colorVariant="silver" />
				{/* <Typography mt={2}>Loading characters...</Typography> */}
			</Container>
		);
	}

	return <CharacterPage characterInfo={characterRes?.characterInfo} userId={userId} />;
}
