import React, { FC, useEffect, useState } from 'react';
import { Box, IconButton, Typography, CircularProgress, TextField } from '@mui/material';
import ReplayIcon from '@mui/icons-material/Replay';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { ChatMessageSet, TempChatTurn } from '@shared/domain/index.ts';
import { styleEntryFont, commonStyle } from '../../util/index.ts';
import { parseEntriesToText } from '#root/src/shared/index.ts';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

interface TempTurnDisplayProps {
	tempTurn: TempChatTurn;
	currentTempSetNo: number;
	isProcessing: boolean;
	userEditInput: string;
	botEditInput: string;
	onEditTempTurnText: (value: string, req: boolean) => void;
	onSaveTempTurnText: () => void;
	onRegenerate: () => void;
	changeTempSetNo: (index: number) => void;
}

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
	const [isEditing, setIsEditing] = useState(false); // Local state to control edit mode UI

	const currentSet: ChatMessageSet | undefined = tempTurn.chatTurnSets[currentTempSetNo];

	// When we enter edit mode, populate the text fields from the current set
	const handleStartEdit = () => {
		if (!currentSet) return;
		onEditTempTurnText(parseEntriesToText(currentSet.request.entries), true);
		onEditTempTurnText(parseEntriesToText(currentSet.response.entries), false);
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		setIsEditing(false);
	};

	const handleSaveAndExitEdit = () => {
		onSaveTempTurnText();
		setIsEditing(false);
	};

	useEffect(() => {
		// If the user navigates to a different response set, exit edit mode
		setIsEditing(false);
	}, [currentTempSetNo]);

	if (!currentSet) return null;

	const handlePrevSet = () => changeTempSetNo(currentTempSetNo - 1);
	const handleNextSet = () => changeTempSetNo(currentTempSetNo + 1);

	return (
		<Box
			key={`temp-${tempTurn.sessionId}-${currentTempSetNo}`}
			className={commonStyle.turnContainer}
			sx={{ border: '1px dashed #ccc', p: 1 }}
		>
			{isEditing ? (
				<>
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
					{/* Render Request Entries */}
					{currentSet.request.entries.map((entry, idx) => (
						<span key={`temp-req-${idx}`} className={styleEntryFont('user', entry.type)}>
							{entry.prompt}
						</span>
					))}
					{/* Render Response Entries */}
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
				</>
			)}

			<Box className={commonStyle.buttonGroup} sx={{ justifyContent: 'space-between', width: '100%' }}>
				{isEditing ? (
					<Box>
						<IconButton onClick={handleCancelEdit} disabled={isProcessing} title="Cancel Edit">
							<CancelIcon fontSize="inherit" />
						</IconButton>
						<IconButton
							onClick={handleSaveAndExitEdit}
							disabled={isProcessing || !userEditInput.trim() || !botEditInput.trim()}
							color="primary"
							title="Save Changes"
						>
							<SaveIcon fontSize="inherit" />
						</IconButton>
					</Box>
				) : (
					<Box>
						{/* Navigation Buttons */}
						{tempTurn.chatTurnSets.length > 1 && (
							<>
								<IconButton onClick={handlePrevSet} disabled={currentTempSetNo === 0 || isProcessing}>
									<NavigateBeforeIcon fontSize="inherit" />
								</IconButton>
								<IconButton
									onClick={handleNextSet}
									disabled={currentTempSetNo === tempTurn.chatTurnSets.length - 1 || isProcessing}
								>
									<NavigateNextIcon fontSize="inherit" />
								</IconButton>
							</>
						)}
					</Box>
				)}

				{!isEditing && currentSet.response && (
					<Box>
						<IconButton onClick={handleStartEdit} disabled={isProcessing} title="Edit this turn">
							<EditIcon fontSize="inherit" />
						</IconButton>
						<IconButton onClick={onRegenerate} disabled={isProcessing} title="Regenerate Response">
							<ReplayIcon fontSize="inherit" />
						</IconButton>
					</Box>
				)}
			</Box>
		</Box>
	);
};
