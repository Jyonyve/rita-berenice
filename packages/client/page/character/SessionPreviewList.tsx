import { Box, Divider, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import React, { FC, Fragment } from 'react';
import { useSessionApi } from '../../hook/api/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { GlassCircularProgress } from '../../layout/component/glass/index.js';
import { SafeRichText } from '../../layout/component/SafeRichText.js';
import { formatTimestamp } from '../../util/styleUtils.jsx';
import { LANG_KEYS } from '@rita-berenice/shared/config';

export const SessionPreviewList: FC<{
	userId: string;
	characterId: string;
	handleSessionStart: (sessionId: string) => void;
	localizeDirections?: boolean;
}> = ({ userId, characterId, handleSessionStart, localizeDirections }) => {
	const {
		data: sessionRes,
		isLoading,
		error,
	} = useSessionApi().getSessionsByUserIdAndCharacterId(userId, characterId);

	if (isLoading) {
		return (
			<ListItem sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column', // <-- Add this line
						justifyContent: 'center',
						alignItems: 'center',
					}}
				>
					<GlassCircularProgress colorVariant="silver" />
					<Typography mt={2}>{getLangText(LANG_KEYS.LOADING_SESSIONS)}</Typography>
				</Box>
			</ListItem>
		);
	}
	if (error) {
		return (
			<ListItem>
				<ListItemText
					primary={
						<Typography variant="body2" color="error">
							{`${getLangText(LANG_KEYS.ERROR)}: ${error.message}`}
						</Typography>
					}
				/>
			</ListItem>
		);
	}

	const activeSessions = sessionRes?.sessionInfos?.filter((info) => info.status === 'active') || [];

	if (activeSessions.length === 0) {
		return (
			<ListItem>
				<ListItemText
					primary={
						<Typography variant="body2" color="text.secondary">
							{getLangText(LANG_KEYS.NO_SESSIONS)}
						</Typography>
					}
				/>
			</ListItem>
		);
	}

	return (
		<>
			{activeSessions.map((info, index) => (
				// Use React.Fragment to provide a key for each looped item
				<Fragment key={info.sessionId}>
					<ListItem disablePadding>
						<ListItemButton onClick={() => handleSessionStart(info.sessionId)}>
							<ListItemText
								disableTypography
								primary={
									<Box>
										{/* --- ROW 1: Title and Timestamp --- */}
										<Box
											sx={{
												display: 'flex',
												justifyContent: 'space-between',
												alignItems: 'center',
												width: '100%',
											}}
										>
											<Typography variant="subtitle2" sx={{ flexShrink: 0, pr: 2 }}>
												{info.title}
											</Typography>
											<Typography
												variant="body2"
												color="text.secondary"
												sx={{
													whiteSpace: 'nowrap',
													overflow: 'hidden',
													textOverflow: 'ellipsis',
													textAlign: 'right',
												}}
											>
												{formatTimestamp(info.updatedAt)}
											</Typography>
										</Box>
										{/* --- ROW 2: Message Snippet --- */}
										<SafeRichText
											text={info.lastCharMessage}
											localizeDirections={localizeDirections}
											variant="body2"
											color="text.secondary"
											sx={{
												mt: 0.5,
												display: '-webkit-box',
												overflow: 'hidden',
												textOverflow: 'ellipsis',
												WebkitBoxOrient: 'vertical',
												WebkitLineClamp: 2,
											}}
										/>
									</Box>
								}
							/>
						</ListItemButton>
					</ListItem>
					{/* Render a divider after each item except the last one */}
					{index < activeSessions.length - 1 && <Divider component="li" />}
				</Fragment>
			))}
		</>
	);
};
