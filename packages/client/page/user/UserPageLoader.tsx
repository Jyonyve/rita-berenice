// src/client/page/UserPageLoader.tsx
import { Container, Typography } from '@mui/material';

import { GlassCircularProgress } from '../../layout/component/glass/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { useAuth } from '../../provider/AuthProvider.jsx';
import { UserPage } from './UserPage.jsx';
import { useCharacterApi, useCredentialApi, useSessionApi, useUserApi } from '../../hook/index.js';
import { LANG_KEYS } from '@rita-berenice/shared/config';

export function UserPageLoader() {
	const { userId } = useAuth();
	const queryUserId = userId ?? '';
	const { data: userRes, isLoading } = useUserApi().getMe(!!userId);
	const { data: charRes } = useCharacterApi().getCharactersByUserId(queryUserId);
	const { data: sessRes } = useSessionApi().getSessionsByUserId(queryUserId);
	const { data: credRes } = useCredentialApi().getUserApiKeyMetadata(queryUserId);

	if (!userId || isLoading || !userRes || !charRes || !sessRes || !credRes) {
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
			myCharacters={charRes?.characterInfos}
			mySessions={sessRes.sessionInfos}
			configuredKeyTypes={credRes.configuredKeyTypes}
			isMine={userRes.userInfo.userId === userId}
		/>
	);
}

export default UserPageLoader;
