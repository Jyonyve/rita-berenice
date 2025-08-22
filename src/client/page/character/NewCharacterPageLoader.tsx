import { CircularProgress, Container, Typography } from '@mui/material';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCharacterApi } from '../../hook/index.ts';
import { useAuth } from '../../provider/index.ts';
import CharacterPage from './CharacterPage.tsx';
import { GlassCircularProgress } from '../../layout/glass/index.ts';
import { getLangText } from '../../util/translateUtils.ts';
import { LANG_KEYS } from '#shared/config/langConstants.js';
import NewCharacterPage from './NewCharacterPage.jsx';

export function NewCharacterPageLoader() {
	const { userId } = useAuth();

	return <NewCharacterPage userId={userId} />;
}
