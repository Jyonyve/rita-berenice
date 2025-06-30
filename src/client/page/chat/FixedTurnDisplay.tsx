import React, { FC } from 'react';
import { Box, IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { ChatTurn } from '@shared/domain/index.js';
import { styleEntryFont, commonStyle } from '../../util/index.js';

interface FixedTurnDisplayProps {
	turn: ChatTurn;
	onEdit: (turn: ChatTurn) => void;
}

export const FixedTurnDisplay: FC<FixedTurnDisplayProps> = ({ turn, onEdit }) => {
	return (
		<Box key={`${turn.sessionId}-${turn.sequence}`} className={commonStyle.turnContainer}>
			{/* Render Request Entries */}
			{turn.request.entries.map((entry, idx) => (
				<span key={`req-${turn.sequence}-${idx}`} className={styleEntryFont('user', entry.type)}>
					{entry.prompt}
				</span>
			))}
			{/* Render Response Entries */}
			{turn.response.entries.map((entry, idx) => (
				<span key={`res-${turn.sequence}-${idx}`} className={styleEntryFont('assistant', entry.type)}>
					{entry.prompt}
				</span>
			))}
			{/* Buttons for Fixed Turn */}
			<Box className={commonStyle.buttonGroup}>
				<IconButton
					size="small"
					aria-label="edit turn"
					onClick={() => onEdit(turn)}
					title="Edit User Input"
				>
					<EditIcon fontSize="inherit" />
				</IconButton>
			</Box>
		</Box>
	);
};
