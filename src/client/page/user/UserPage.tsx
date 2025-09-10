// src/client/page/UserPage.tsx
import { FC, useMemo } from 'react';
import { Box, Grid, List, Typography } from '@mui/material';

import { GlassCard, GlassPaper } from '../../layout/glass/index.js';
import { containerSpacing } from '../../style/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { LANG_KEYS } from '#shared/config/langConstants.js';
import { UserInfo } from '#shared/domain/user/UserInterfaces.js';

const UserPage: FC<{ userInfo: UserInfo }> = ({ userInfo }) => {
	return (
		<GlassPaper key="user-page" className="paper">
			<Grid container spacing={containerSpacing}>
				{/* Left: Profile summary or instructions */}
				<Grid sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
					<GlassCard variant="outlined">
						<Typography variant="h6" sx={{ mt: 1, ml: 1 }}>
							{getLangText(LANG_KEYS.USER_INFO)}
						</Typography>
						{/* <Typography variant="body2" sx={{ mt: 1, ml: 2, mb: 2 }}>
							{getLangText(LANG_KEYS.USER_PAGE_INTRO) }
						</Typography> */}
					</GlassCard>

					<GlassCard variant="outlined">
						<Typography variant="subtitle1" color="text.secondary" mb={1} sx={{ ml: 1, mt: 1 }}>
							{getLangText(LANG_KEYS.MY_CHARACTERS)}
						</Typography>
						{/* <List dense>
							{myCharacters.length === 0 ? (
								<Typography variant="body2" sx={{ px: 2, py: 1 }}>
									{getLangText(LANG_KEYS.NO_CHARACTERS)}
								</Typography>
							) : (
								myCharacters.map((c: any) => (
									<Box
										key={c.characterId}
										sx={{ px: 2, py: 1, cursor: 'pointer', '&:hover': { opacity: 0.85 } }}
										onClick={() => handleOpenCharacter(c.characterId)}
									>
										<Typography variant="body2">{c.showName}</Typography>
										<Typography variant="caption" color="text.secondary">
											{c.characterId}
										</Typography>
									</Box>
								))
							)}
						</List> */}
					</GlassCard>
				</Grid>
			</Grid>
		</GlassPaper>
	);
};

export default UserPage;
