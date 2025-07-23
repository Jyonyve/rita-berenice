// src/client/component/page/chat/TempTurnDisplay.tsx

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
 * Features smaller, transparent icon buttons and response navigation controls.
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
				// Ensure the hover buttons don't interfere with text content
				paddingTop: isEditing ? 0 : '32px',
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

			{/* Buttons Group - Now with smaller, transparent buttons */}
			<Box
				className="hover-buttons"
				sx={{
					position: 'absolute',
					top: 4,
					right: 4,
					display: 'flex',
					alignItems: 'center',
					gap: '2px',
					p: '1px',
					borderRadius: '6px',
					backgroundColor: 'rgba(255, 255, 255, 0.1)', // More transparent
					backdropFilter: 'blur(4px)',
					border: '1px solid rgba(255, 255, 255, 0.1)',
					boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
				}}
			>
				{isEditing ? (
					<>
						<IconButton
							size="small"
							onClick={handleCancelEdit}
							disabled={isProcessing}
							title="Cancel Edit"
							sx={{
								minWidth: '24px',
								width: '24px',
								height: '24px',
								padding: '2px',
								backgroundColor: 'transparent',
								'&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
							}}
						>
							<CancelIcon sx={{ fontSize: '14px' }} />
						</IconButton>
						<IconButton
							size="small"
							onClick={handleSaveAndExitEdit}
							disabled={isProcessing || !userEditInput.trim() || !botEditInput.trim()}
							color="primary"
							title="Save Changes"
							sx={{
								minWidth: '24px',
								width: '24px',
								height: '24px',
								padding: '2px',
								backgroundColor: 'transparent',
								'&:hover': { backgroundColor: 'rgba(25, 118, 210, 0.1)' },
							}}
						>
							<SaveIcon sx={{ fontSize: '14px' }} />
						</IconButton>
					</>
				) : (
					<>
						{/* Navigation Controls with Count Display */}
						{tempTurn.chatTurnSets.length > 1 && (
							<>
								<IconButton
									size="small"
									title="Previous Response"
									onClick={handlePrevSet}
									disabled={currentTempSetNo === 0 || isProcessing}
									sx={{
										minWidth: '24px',
										width: '24px',
										height: '24px',
										padding: '2px',
										backgroundColor: 'transparent',
										'&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
									}}
								>
									<NavigateBeforeIcon sx={{ fontSize: '14px' }} />
								</IconButton>

								{/* Response Count Display */}
								<Typography
									variant="caption"
									sx={{
										px: 0.5,
										fontSize: '11px',
										fontWeight: 500,
										color: 'rgba(255, 255, 255, 0.8)',
										userSelect: 'none',
										minWidth: 'fit-content',
										textAlign: 'center',
									}}
								>
									{currentTempSetNo + 1}/{tempTurn.chatTurnSets.length}
								</Typography>

								<IconButton
									size="small"
									title="Next Response"
									onClick={handleNextSet}
									disabled={currentTempSetNo === tempTurn.chatTurnSets.length - 1 || isProcessing}
									sx={{
										minWidth: '24px',
										width: '24px',
										height: '24px',
										padding: '2px',
										backgroundColor: 'transparent',
										'&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
									}}
								>
									<NavigateNextIcon sx={{ fontSize: '14px' }} />
								</IconButton>
							</>
						)}

						{/* Action Buttons */}
						{currentSet.response && (
							<>
								<IconButton
									size="small"
									onClick={handleStartEdit}
									disabled={isProcessing}
									title="Edit this turn"
									sx={{
										minWidth: '24px',
										width: '24px',
										height: '24px',
										padding: '2px',
										backgroundColor: 'transparent',
										'&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
									}}
								>
									<EditIcon sx={{ fontSize: '14px' }} />
								</IconButton>
								<IconButton
									size="small"
									onClick={onRegenerate}
									disabled={isProcessing}
									title="Regenerate Response"
									sx={{
										minWidth: '24px',
										width: '24px',
										height: '24px',
										padding: '2px',
										backgroundColor: 'transparent',
										'&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
									}}
								>
									<ReplayIcon sx={{ fontSize: '14px' }} />
								</IconButton>
							</>
						)}
					</>
				)}
			</Box>
		</Box>
	);
};
