import { CircularProgress, Container, Typography } from '@mui/material';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useCharacterApi, useLoreApi } from '../../hook/index.js';
import { useAuth } from '../../provider/index.js';
import HistoryPage from './HistoryPage.jsx';
import { GlassCircularProgress } from '../../layout/glass/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { LANG_KEYS } from '#shared/config/langConstants.js';

export function HistoryPageLoader() {
	const navigate = useNavigate();
	const { historyId } = useParams();
	const { userId } = useAuth();

	useEffect(() => {
		if (!historyId) {
			navigate('/not-found-historyId', { replace: true });
		}
	}, [historyId, navigate]);

	if (!historyId) return;

	const { data: historyRes, isLoading } = useLoreApi().getHistory(historyId);

	if (isLoading || !historyRes) {
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
				<Typography sx={{ mt: 2 }}>{getLangText(LANG_KEYS.LOADING_STORIES)}</Typography>
			</Container>
		);
	}

	return <HistoryPage historyInfo={historyRes?.historyInfo} userId={userId} />;
}
