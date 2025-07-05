import { FC } from 'react';
import { ListItem, ListItemText, Typography, Divider } from '@mui/material';
import { useChatApi } from '../../hook/api/useChatApi.js';
import { parseEntriesToText } from '#shared/util/chatParseUtils.js';
import { ListItemButton } from '@mui/material';
import { UserInfo } from '#shared/domain/user/UserInterfaces.js';

export const SessionPreviewList: FC<{
	userInfo: UserInfo;
	handleSessionStart: (sessionId: string) => void;
}> = ({ userInfo, handleSessionStart }) => {
	const {
		data: tempTurnsResponse,
		isLoading,
		error,
	} = useChatApi().getLastTempTurnsForSessions(userInfo.sessionIds || []);

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

	if (!tempTurnsResponse?.tempChatTurns?.length) {
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
			{tempTurnsResponse.tempChatTurns.map((turn) => {
				const turnSet =
					turn.fixedSetNo < 0 ? turn.chatTurnSets.at(-1) : turn.chatTurnSets[turn.fixedSetNo];
				const title =
					turnSet?.request.showName && turnSet?.response.showName
						? `${turnSet.request.showName} X ${turnSet.response.showName}`
						: `Session ${turn.sessionId.slice(-6)}`;
				const updatedAt = turn.updatedAt ? new Date(turn.updatedAt).toLocaleString() : '';
				const preview = parseEntriesToText(turnSet?.response.entries || []).slice(0, 140);

				return (
					<ListItem disablePadding key={turn.sessionId}>
						<ListItemButton onClick={() => handleSessionStart(turn.sessionId)}>
							<ListItemText
								primary={
									<>
										<Typography variant="subtitle1">{title}</Typography>
										<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
											{preview}
										</Typography>
									</>
								}
								secondary={updatedAt}
							/>
						</ListItemButton>
						<Divider component="li" />
					</ListItem>
				);
			})}
		</>
	);
};
