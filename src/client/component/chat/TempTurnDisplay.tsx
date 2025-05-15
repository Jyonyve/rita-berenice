import React, { FC } from 'react';
import { Box, IconButton, Typography, CircularProgress } from '@mui/material';
import ReplayIcon from '@mui/icons-material/Replay';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { ChatMessageSet, TempChatTurn } from '@shared/domain/index.ts';
import { styleEntryFont, commonStyle } from '../../util/index.ts';

interface TempTurnDisplayProps {
	tempTurn: TempChatTurn;
	currentTempSetNo: number;
	isProcessing: boolean;
	onRegenerate: () => void;
	changeTempSetNo: (index: number) => void; // Optional, if needed for other purposes
}

export const TempTurnDisplay: FC<TempTurnDisplayProps> = ({
	tempTurn,
	changeTempSetNo,
	currentTempSetNo,
	isProcessing,
	onRegenerate,
}) => {
	const totalSets = tempTurn.chatTurnSets;
	const currentSet: ChatMessageSet | undefined = totalSets[currentTempSetNo];
	if (!currentSet) return null; // Safety check

	const handlePrevSet = () => {
		currentTempSetNo > 0 && changeTempSetNo(currentTempSetNo - 1);
	};

	const handleNextSet = () => {
		currentTempSetNo < totalSets.length - 1 && changeTempSetNo(currentTempSetNo + 1);
	};
	return (
		<Box
			key={`temp-${tempTurn.sessionId}`}
			className={commonStyle.turnContainer}
			sx={{ border: '1px dashed #ccc', p: 1 }}
		>
			{' '}
			{/* Display current set number and total sets */}
			{totalSets.length > 1 && (
				<Typography variant="caption" display="block" textAlign="center" sx={{ mb: 1 }}>
					Variation {currentTempSetNo + 1} of {totalSets.length}
				</Typography>
			)}
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
			{/* Navigation Buttons (Previous/Next) */}
			<Box>
				{totalSets.length > 1 && ( // Only show navigation if there are multiple sets
					<>
						<IconButton
							size="small"
							aria-label="previous set"
							onClick={handlePrevSet}
							disabled={currentTempSetNo === 0 || isProcessing}
							title="Previous Variation"
						>
							<NavigateBeforeIcon fontSize="inherit" />
						</IconButton>
						<IconButton
							size="small"
							aria-label="next set"
							onClick={handleNextSet}
							disabled={currentTempSetNo === totalSets.length - 1 || isProcessing}
							title="Next Variation"
						>
							<NavigateNextIcon fontSize="inherit" />
						</IconButton>
					</>
				)}
			</Box>
			{/* Action Buttons (Regenerate) - only if response exists */}
			{currentSet.response && (
				<Box>
					<IconButton
						size="small"
						aria-label="regenerate response"
						onClick={onRegenerate}
						disabled={isProcessing}
						title="Regenerate Response"
					>
						<ReplayIcon fontSize="inherit" />
					</IconButton>
					{/* You could add an "Accept this version" button here too */}
				</Box>
			)}
		</Box>
	);
};
