import { CircularProgress, Container, Typography } from '@mui/material';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCharacterApi } from '../../hook/index.js';
import { useAuth } from '../../provider/index.js';
import CharacterPage from './CharacterPage.jsx';
import { GlassCircularProgress } from '../../layout/component/glass/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { LANG_KEYS } from '@rita-berenice/shared/config';

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
				sx={{
					display: 'flex',
					flexDirection: 'column', // <-- Add this line
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

	const isMine = !!(userId && userId === characterRes.characterInfo.userId);

	return (
		<CharacterPage
			characterInfo={characterRes?.characterInfo}
			portraitUrls={characterRes.characterPortraits[characterId]}
			avatarUrls={characterRes.characterAvatars[characterId]}
			userId={userId || ''}
			isMine={isMine}
		/>
	);
}
