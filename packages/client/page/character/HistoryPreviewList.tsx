import { Box, Divider, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material';
import React, { FC, Fragment } from 'react'; // Import Fragment
import { useHistoryApi } from '../../hook/api/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { GlassCircularProgress } from '../../layout/glass/index.js';
import { LANG_KEYS } from '@rita-berenice/shared/config/langConstants.js';
import { formatTimestamp } from '../../util/styleUtils.jsx';

export const HistoryPreviewList: FC<{
	characterId: string;
	handleHistory: (historyId: string) => void;
}> = ({ characterId, handleHistory }) => {
	const { data: historyRes, isLoading, error } = useHistoryApi().getHistories(characterId);
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
					<Typography mt={2}>{getLangText(LANG_KEYS.LOADING_STORIES)}</Typography>
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

	if (historyRes?.historyInfos.length === 0) {
		return (
			<ListItem>
				<ListItemText
					primary={
						<Typography variant="body2" color="text.secondary">
							{getLangText(LANG_KEYS.NO_HISTORIES)}
						</Typography>
					}
				/>
			</ListItem>
		);
	}

	return (
		<>
			{historyRes?.historyInfos.map((info, index) => (
				// Use React.Fragment to provide a key for each looped item
				<Fragment key={info.historyId}>
					<ListItem disablePadding>
						<ListItemButton onClick={() => handleHistory(info.historyId)}>
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
											{info.content}
										</Typography>
									</Box>
								}
							/>
						</ListItemButton>
					</ListItem>
					{/* Render a divider after each item except the last one */}
					{index < historyRes.historyInfos.length - 1 && <Divider component="li" />}
				</Fragment>
			))}
		</>
	);
};
