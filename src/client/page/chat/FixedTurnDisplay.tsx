// src/client/component/page/chat/FixedTurnDisplay.tsx

import { ChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import EditIcon from '@mui/icons-material/Edit';
import { Box, IconButton, Typography } from '@mui/material';
import { FC } from 'react';
import { commonStyle, styleEntryFont } from '../../util/styleUtils.jsx';

interface FixedTurnDisplayProps {
	turn: ChatTurn;
}

export const FixedTurnDisplay: FC<FixedTurnDisplayProps> = ({ turn }) => {
	return (
		<Box key={`${turn.sessionId}-${turn.sequence}`} className={commonStyle.turnContainer}>
			{/* User Request Block */}
			<Box sx={{ mb: 1 }}>
				{/* Added a container for the request */}
				{turn.request.entries.map((entry, idx) => (
					<Typography
						sx={{ whiteSpace: 'pre-line' }}
						key={`req-${turn.sequence}-${idx}`}
						className={styleEntryFont('user', entry.type)}
					>
						{entry.prompt}
					</Typography>
				))}
			</Box>

			{/* Bot Response Block */}
			<Box sx={{ mb: 1 }}>
				{/* Added a container for the response */}
				{turn.response.entries.map((entry, idx) => (
					<Typography
						sx={{ whiteSpace: 'pre-line' }}
						key={`res-${turn.sequence}-${idx}`}
						className={styleEntryFont('assistant', entry.type)}
					>
						{entry.prompt}
					</Typography>
				))}
			</Box>

			{/* Buttons for Fixed Turn */}
			{/* <Box className={commonStyle.buttonGroup}>
				<IconButton
					size="small"
					aria-label="edit turn"
					onClick={() => onEdit(turn)}
					title="Edit User Input"
				>
					<EditIcon fontSize="inherit" />
				</IconButton>
			</Box> */}
		</Box>
	);
};
