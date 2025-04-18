import React, { FC } from 'react';
import { Box, IconButton, Typography, CircularProgress } from '@mui/material';
import ReplayIcon from '@mui/icons-material/Replay';
import { TempChatTurn } from '@shared/domain/index.ts';
import { styleEntryFont } from '../../util/chatCompUtils.ts';
import styles from './ChatComp.module.scss'; // Assuming shared styles

interface TempTurnDisplayProps {
	tempTurn: TempChatTurn;
	isProcessing: boolean;
	onRegenerate: () => void;
}

export const TempTurnDisplay: FC<TempTurnDisplayProps> = ({
	tempTurn,
	isProcessing,
	onRegenerate,
}) => {
	// Assuming chatTurnSets always has at least one element when tempTurn exists
	const currentSet = tempTurn.chatTurnSets[0];
	if (!currentSet) return null; // Safety check

	return (
		<Box
			key={`temp-${tempTurn.sessionId}`}
			className={styles.turnContainer}
			sx={{ border: '1px dashed #ccc', p: 1 }}
		>
			{/* Render Request Entries */}
			{currentSet.request.entries.map((entry, idx) => (
				<span key={`temp-req-${idx}`} className={styleEntryFont('user', entry.type)}>
					{entry.prompt}
				</span>
			))}
			{/* Render Response Entries (or loading state) */}
			{currentSet.response ? (
				currentSet.response.entries.map((entry, idx) => (
					<span key={`temp-res-${idx}`} className={styleEntryFont('assistant', entry.type)}>
						{entry.prompt}
					</span>
				))
			) : (
				<Typography sx={{ fontStyle: 'italic', color: 'gray', ml: '10px' }}>
					<CircularProgress size={12} sx={{ mr: 1 }} /> Generating response...
				</Typography>
			)}
			{/* Buttons for Temp Turn */}
			{currentSet.response && ( // Show only if response exists
				<Box className={styles.buttonGroup}>
					<IconButton
						size="small"
						aria-label="regenerate response"
						onClick={onRegenerate}
						disabled={isProcessing}
						title="Regenerate Response"
					>
						<ReplayIcon fontSize="inherit" />
					</IconButton>
				</Box>
			)}
		</Box>
	);
};
