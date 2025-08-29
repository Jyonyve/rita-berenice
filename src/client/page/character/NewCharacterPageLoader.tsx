import { CircularProgress, Container, Typography } from '@mui/material';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCharacterApi } from '../../hook/index.js';
import { useAuth } from '../../provider/index.js';
import { GlassPaper } from '../../layout/glass/index.js';
import { routeConstants } from '../../routeConstants.js';
import { CharacterForm } from './CharacterForm.jsx';

export function NewCharacterPageLoader() {
	const { userId } = useAuth();
	const navigate = useNavigate();
	return (
		<GlassPaper>
			<CharacterForm
				mode="create"
				userId={userId}
				onCancel={() => navigate(`/${routeConstants.CHARACTER}`)}
				onSuccess={(id) => navigate(`/${routeConstants.CHARACTER}/${id}`)}
			/>
		</GlassPaper>
	);
}
