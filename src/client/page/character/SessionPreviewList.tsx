import { FC } from 'react';
import { ListItem, ListItemText, Typography, Divider, CircularProgress, Box } from '@mui/material';
import { useChatApi } from '../../hook/api/useChatApi.js';
import { parseEntriesToText, parseSessionId } from '#shared/util/chatParseUtils.js';
import { ListItemButton } from '@mui/material';
import { UserInfo } from '#shared/domain/user/UserInterfaces.js';
import { useSessionApi } from '../../hook/api/useSessionApi.js';
import { notFoundMessage } from '#shared/util/languageUtils.js';

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

	if (!sessionRes?.sessionInfos?.length) {
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
			{sessionRes.sessionInfos
				.filter((info) => info.status === 'active')
				.map((info) => {
					return (
						<ListItem disablePadding key={info.sessionId}>
							<ListItemButton onClick={() => handleSessionStart(info.sessionId)}>
								<ListItemText
									// We disable the default styling to build our own layout
									disableTypography
									primary={
										<Box>
											{/* --- ROW 1: Title and Timestamp --- */}
											<Box
												sx={{
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'center', // Vertically aligns the title and date
													width: '100%',
												}}
											>
												{/* Title - Aligned to the left */}
												<Typography
													variant="subtitle2"
													sx={{
														// These styles prevent a long title from pushing the date away
														overflow: 'hidden',
														textOverflow: 'ellipsis',
														whiteSpace: 'nowrap',
														pr: 2, // Adds space between title and date
													}}
												>
													{info.title}
												</Typography>

												{/* Timestamp - Aligned to the right */}
												<Typography
													variant="body2" // Using body2 for a clean, matching style
													color="text.secondary"
													sx={{
														flexShrink: 0, // Prevents the date from wrapping or shrinking
													}}
												>
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
							<Divider component="li" />
						</ListItem>
					);
				})}
		</>
	);
};
