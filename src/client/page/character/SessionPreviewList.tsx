import {
	Box,
	CircularProgress,
	Divider,
	ListItem,
	ListItemButton,
	ListItemText,
	Typography,
} from '@mui/material';
import React, { FC, Fragment } from 'react'; // Import Fragment
import { useSessionApi } from '../../hook/api/index.js';
import { notFoundMessage } from '../../util/translateUtils.js';

export const SessionPreviewList: FC<{
	userId: string;
	characterId: string;
	handleSessionStart: (sessionId: string) => void;
}> = ({ userId, characterId, handleSessionStart }) => {
	const {
		data: sessionRes,
		isLoading,
		error,
	} = useSessionApi().getSessionsByUserIdAndCharacterId(userId, characterId);

	if (isLoading) {
		return (
			<ListItem>
				<CircularProgress size={24} />
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

	const activeSessions = sessionRes?.sessionInfos?.filter((info) => info.status === 'active') || [];

	if (activeSessions.length === 0) {
		return (
			<ListItem>
				<ListItemText
					primary={
						<Typography variant="body2" color="text.secondary">
							{notFoundMessage('sessions')}
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
											<Typography
												variant="subtitle2"
												sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pr: 2 }}
											>
												{info.title}
											</Typography>
											<Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
												{info.updatedAt}
											</Typography>
										</Box>
										{/* --- ROW 2: Message Snippet --- */}
										<Typography
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
										>
											{info.lastCharMessage}
										</Typography>
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
