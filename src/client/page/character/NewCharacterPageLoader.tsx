import { CircularProgress, Container, Typography } from '@mui/material';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCharacterApi } from '../../hook/index.js';
import { useAuth } from '../../provider/index.js';
import CharacterPage from './CharacterPage.tsx';
import { GlassCircularProgress } from '../../layout/glass/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { LANG_KEYS } from '#shared/config/langConstants.js';
import NewCharacterPage from './NewCharacterPage.jsx';

export function NewCharacterPageLoader() {
	const { userId } = useAuth();

	return <NewCharacterPage userId={userId} />;
}
