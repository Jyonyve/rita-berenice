import { ChatMessageSet, TempChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import { parseEntriesToText } from '#shared/util/chatParseUtils.js';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ReplayIcon from '@mui/icons-material/Replay';
import SaveIcon from '@mui/icons-material/Save';
import { Box, CircularProgress, IconButton, TextField, Typography } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { commonStyle, styleEntryFont } from '../../util/styleUtils.jsx';

/**
 * Props for the TempTurnDisplay component.
 */
interface TempTurnDisplayProps {
	tempTurn: TempChatTurn;
	currentTempSetNo: number;
	isProcessing: boolean;
	userEditInput: string;
	botEditInput: string;
	onEditTempTurnText: (value: string, isRequest: boolean) => void;
	onSaveTempTurnText: () => void;
	onRegenerate: () => void;
	changeTempSetNo: (index: number) => void;
}

/**
 * A component for displaying a temporary chat turn with inline editing capabilities.
 * It combines a clean display with on-hover controls and an in-place editing UI,
 * making it suitable for both desktop and mobile views.
 */
export const TempTurnDisplay: FC<TempTurnDisplayProps> = ({
	tempTurn,
	currentTempSetNo,
	isProcessing,
	userEditInput,
	botEditInput,
	onEditTempTurnText,
	onSaveTempTurnText,
	onRegenerate,
	changeTempSetNo,
}) => {
	const [isEditing, setIsEditing] = useState(false);
	const currentSet: ChatMessageSet | undefined = tempTurn?.chatTurnSets?.[currentTempSetNo];

	// Exit editing mode if the response set changes
	useEffect(() => {
		setIsEditing(false);
	}, [currentTempSetNo]);

	if (!currentSet) return null;

	const handleStartEdit = () => {
		if (!currentSet) return;
		// Populate text fields with current content
		onEditTempTurnText(parseEntriesToText(currentSet.request.entries), true);
		onEditTempTurnText(parseEntriesToText(currentSet.response.entries), false);
		setIsEditing(true);
	};

	const handleCancelEdit = () => setIsEditing(false);

	const handleSaveAndExitEdit = () => {
		onSaveTempTurnText();
		setIsEditing(false);
	};

	const handlePrevSet = () => changeTempSetNo(currentTempSetNo - 1);
	const handleNextSet = () => changeTempSetNo(currentTempSetNo + 1);

	return (
		<Box
			className={commonStyle.turnContainer}
			sx={{
				position: 'relative',
				'& .hover-buttons': {
					opacity: 0,
					visibility: 'hidden',
					transition: 'opacity 0.2s, visibility 0.2s',
				},
				'&:hover .hover-buttons': { opacity: 1, visibility: 'visible' },
			}}
		>
			{isEditing ? (
				<>
					{/* Editing UI */}
					<TextField
						fullWidth
						multiline
						label="Edit User Request"
						variant="outlined"
						value={userEditInput}
						onChange={(e) => onEditTempTurnText(e.target.value, true)}
						disabled={isProcessing}
						sx={{ mb: 1 }}
					/>
					<TextField
						fullWidth
						multiline
						label="Edit Bot Response"
						variant="outlined"
						value={botEditInput}
						onChange={(e) => onEditTempTurnText(e.target.value, false)}
						disabled={isProcessing}
					/>
				</>
			) : (
				<>
					{/* Display UI */}
					<Box sx={{ mb: 1 }}>
						{currentSet.request.entries.map((entry, idx) => (
							<Typography
								sx={{ whiteSpace: 'pre-line' }}
								key={`req-${idx}`}
								className={styleEntryFont('user', entry.type)}
							>
								{entry.prompt}
							</Typography>
						))}
					</Box>
					<Box>
						{currentSet.response ? (
							currentSet.response.entries.map((entry, idx) => (
								<Typography
									sx={{ whiteSpace: 'pre-line' }}
									key={`res-${idx}`}
									className={styleEntryFont('assistant', entry.type)}
								>
									{entry.prompt}
								</Typography>
							))
						) : (
							<Typography sx={{ fontStyle: 'italic', color: 'gray' }}>
								<CircularProgress size={12} sx={{ mr: 1 }} /> Generating response...
							</Typography>
						)}
					</Box>
				</>
			)}

			{/* Buttons Group */}
			<Box
				className="hover-buttons"
				sx={{
					position: 'absolute',
					top: 4,
					right: 4,
					display: 'flex',
					gap: '4px',
					p: '2px',
					borderRadius: '8px',
					backgroundColor: 'rgba(240, 240, 240, 0.95)',
					boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
				}}
			>
				{isEditing ? (
					<>
						<IconButton
							size="small"
							onClick={handleCancelEdit}
							disabled={isProcessing}
							title="Cancel Edit"
						>
							<CancelIcon fontSize="small" />
						</IconButton>
						<IconButton
							size="small"
							onClick={handleSaveAndExitEdit}
							disabled={isProcessing || !userEditInput.trim() || !botEditInput.trim()}
							color="primary"
							title="Save Changes"
						>
							<SaveIcon fontSize="small" />
						</IconButton>
					</>
				) : (
					<>
						{tempTurn.chatTurnSets.length > 1 && (
							<>
								<IconButton
									size="small"
									title="Previous Response"
									onClick={handlePrevSet}
									disabled={currentTempSetNo === 0 || isProcessing}
								>
									<NavigateBeforeIcon fontSize="small" />
								</IconButton>
								<IconButton
									size="small"
									title="Next Response"
									onClick={handleNextSet}
									disabled={currentTempSetNo === tempTurn.chatTurnSets.length - 1 || isProcessing}
								>
									<NavigateNextIcon fontSize="small" />
								</IconButton>
							</>
						)}
						{currentSet.response && (
							<>
								<IconButton
									size="small"
									onClick={handleStartEdit}
									disabled={isProcessing}
									title="Edit this turn"
								>
									<EditIcon fontSize="small" />
								</IconButton>
								<IconButton
									size="small"
									onClick={onRegenerate}
									disabled={isProcessing}
									title="Regenerate Response"
								>
									<ReplayIcon fontSize="small" />
								</IconButton>
							</>
						)}
					</>
				)}
			</Box>
		</Box>
	);
};
