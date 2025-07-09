import { FC } from 'react';
import { ListItem, ListItemText, Typography, Divider } from '@mui/material';
import { useChatApi } from '../../hook/api/useChatApi.js';
import { parseEntriesToText } from '#shared/util/chatParseUtils.js';
import { ListItemButton } from '@mui/material';
import { UserInfo } from '#shared/domain/user/UserInterfaces.js';
import { useSessionApi } from '../../hook/api/useSessionApi.js';

export const SessionPreviewList: FC<{
	userId: string;
	handleSessionStart: (sessionId: string) => void;
}> = ({ userId, handleSessionStart }) => {
	const { data: sessionRes, isLoading, error } = useSessionApi().getSessionsByUserId(userId);

	if (isLoading) {
		return (
			<ListItem>
				<ListItemText
					primary={
						<Typography variant="body2" color="text.secondary">
							Loading session previews...
						</Typography>
					}
				/>
			</ListItem>
		);
	}
	if (error) {
		return (
			<ListItem>
				<ListItemText
					primary={
						<Typography variant="body2" color="error">
							Error: {error.message}
						</Typography>
					}
				/>
			</ListItem>
		);
	}

	if (!sessionRes?.sessionInfos?.length) {
		return (
			<ListItem>
				<ListItemText
					primary={
						<Typography variant="body2" color="text.secondary">
							No sessions found.
						</Typography>
					}
				/>
			</ListItem>
		);
	}

	return (
		<>
			{sessionRes.sessionInfos
				.filter((info) => info.status === 'active')
				.map((info) => {
					return (
						<ListItem disablePadding key={info.sessionId}>
							<ListItemButton onClick={() => handleSessionStart(info.sessionId)}>
								<ListItemText
									primary={
										<>
											<Typography variant="subtitle1">{info.title}</Typography>
											<Typography
												variant="body2"
												color="text.secondary"
												sx={{
													mt: 0.5,
													display: '-webkit-box',
													overflow: 'hidden',
													textOverflow: 'ellipsis',
													WebkitBoxOrient: 'vertical',
													WebkitLineClamp: 2, // The number of lines to show
												}}
											>
												{info.lastCharMessage}
											</Typography>
										</>
									}
									secondary={info.updatedAt}
								/>
							</ListItemButton>
							<Divider component="li" />
						</ListItem>
					);
				})}
		</>
	);
};
