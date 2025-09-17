// src/client/page/UserPageLoader.tsx
import { Container, Typography } from '@mui/material';

import { GlassCircularProgress } from '../../layout/glass/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { LANG_KEYS } from '#shared/config/langConstants.js';
import { useAuth } from '../../provider/AuthProvider.jsx';
import UserPage from './UserPage.jsx';
import { useCharacterApi, useSessionApi, useUserApi } from '../../hook/index.js';

export function UserPageLoader() {
	const { userId } = useAuth();
	if (!userId) return null;
	const { data: userRes, isLoading } = useUserApi().getUser(userId);
	const { data: charRes } = useCharacterApi().getCharactersByUserId(userId);
	const { data: sessRes } = useSessionApi().getSessionsByUserId(userId);

	if (isLoading || !userRes || !charRes || !sessRes) {
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
				<Typography sx={{ mt: 2 }}>{getLangText(LANG_KEYS.LOADING_USER)}</Typography>
			</Container>
		);
	}

	return (
		<UserPage
			userInfo={userRes.userInfo}
			myCharacters={charRes?.characterInfos || []}
			mySessions={sessRes.sessionInfos || []}
			isOwnProfile={userRes.userInfo.userId === userId}
		/>
	);
}

export default UserPageLoader;
