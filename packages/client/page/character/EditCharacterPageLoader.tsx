// src/client/page/character/EditCharacterPage.tsx
import { FC, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { GlassCircularProgress, GlassPaper } from '../../layout/component/glass/index.js';
import { routeConstants } from '../../routeConstants.js';
import { CharacterForm } from './CharacterForm.jsx';
import { useCharacterApi } from '../../hook/index.js';
import { Container, Typography } from '@mui/material';
import { useAuth } from '../../provider/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { LANG_KEYS } from '@rita-berenice/shared/config';

export const EditCharacterPageLoader = () => {
	const navigate = useNavigate();
	const { userId } = useAuth();
	const { characterId } = useParams<{ characterId: string }>();

	useEffect(() => {
		if (!characterId) {
			navigate('/not-found-characterId', { replace: true });
		}
	}, [characterId, navigate]);

	// The query below is a hook, so the bail-out has to come after it, not before - an early return
	// here changes the hook order between renders. An empty id keeps the query disabled through
	// its own `enabled: !!characterId` guard, so nothing is fetched meanwhile.
	const { data: characterRes, isLoading } = useCharacterApi().getCharacter(characterId ?? '');

	if (!characterId || !userId) return null;

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

	const handleGoCharacterPage = () => navigate(`/${routeConstants.CHARACTER}/${characterId}`);

	return (
		<GlassPaper>
			<CharacterForm
				mode="edit"
				characterInfo={characterRes.characterInfo}
				portraitUrls={characterRes.characterPortraits[characterId]}
				avatarUrls={characterRes.characterAvatars[characterId]}
				userId={userId}
				onCancel={handleGoCharacterPage}
				onSuccess={handleGoCharacterPage}
			/>
		</GlassPaper>
	);
};
