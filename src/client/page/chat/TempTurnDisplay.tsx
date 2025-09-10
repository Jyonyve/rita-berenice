// src/client/component/page/chat/TempTurnDisplay.tsx

import { ChatMessageSet, TempChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ReplayIcon from '@mui/icons-material/Replay';
import SaveIcon from '@mui/icons-material/Save';
import { Box, IconButton, TextField, Typography, useTheme } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { commonStyle, styleEntryFont } from '../../util/styleUtils.jsx';
import { REQUEST_CHARACTER_LIMIT } from '#shared/config/constants.js';
import { GlassBox } from '../../layout/glass/GlassBox.jsx';
import { GlassCircularProgress } from '../../layout/glass/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { LANG_KEYS } from '#shared/config/langConstants.js';
import { parseEntriesToText } from '../../util/chatParseUtils.js';

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
 * It now uses dynamic labels and a background color change to indicate text overflow.
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
	const theme = useTheme();
	const [isEditing, setIsEditing] = useState(false);
	const currentSet: ChatMessageSet | undefined = tempTurn?.chatTurnSets?.[currentTempSetNo];

	useEffect(() => {
		setIsEditing(false);
	}, [currentTempSetNo]);

	if (!currentSet) return null;

	const handleStartEdit = () => {
		if (!currentSet) return;
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

	const isUserTextOverflow = userEditInput.length > REQUEST_CHARACTER_LIMIT;
	// const isBotTextOverflow = botEditInput.length > RESPONSE_CHARACTER_LIMIT;

	return (
		<Box
			className={commonStyle.turnContainer}
			sx={{
				position: 'relative',
				// 1. If isEditing, padding is fixed. Otherwise, it's 0 initially.
				paddingTop: isEditing ? theme.spacing(4.5) : 0,
				// 2. The transition still applies for the non-editing hover effect.
				transition: 'padding-top 0.2s ease-in-out',

				// 3. Define the hover-buttons class styles.
				'& .hover-buttons': {
					// If isEditing, buttons are always visible. Otherwise, they start hidden.
					opacity: isEditing ? 1 : 0,
					visibility: isEditing ? 'visible' : 'hidden',
					transition: 'opacity 0.2s, visibility 0.2s',
				},

				// 4. The hover effect only applies when NOT in editing mode.
				...(!isEditing && {
					'&:hover': {
						paddingTop: theme.spacing(4.5),
						'& .hover-buttons': { opacity: 1, visibility: 'visible' },
					},
				}),
			}}
		>
			{isEditing ? (
				<GlassBox gap={2}>
					<TextField
						fullWidth
						multiline
						label={currentSet.request.showName}
						variant="outlined"
						value={userEditInput}
						onChange={(e) => onEditTempTurnText(e.target.value, true)}
						disabled={isProcessing}
						slotProps={{
							htmlInput: { maxLength: REQUEST_CHARACTER_LIMIT },
							input: { sx: { fontSize: theme.typography.body2.fontSize } },
						}}
						error={isUserTextOverflow} // Use the built-in error prop
						sx={{ mb: 3 }}
					/>
					<TextField
						fullWidth
						multiline
						label={currentSet.response.showName}
						variant="outlined"
						value={botEditInput}
						onChange={(e) => onEditTempTurnText(e.target.value, false)}
						disabled={isProcessing}
						slotProps={{
							htmlInput: { maxLength: parseEntriesToText(currentSet.response.entries).length + 100 },
							input: { sx: { fontSize: theme.typography.body2.fontSize } },
						}}
						error={isUserTextOverflow} // Use the built-in error prop
					/>
				</GlassBox>
			) : (
				<>
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
								<GlassCircularProgress size={12} sx={{ mr: 1 }} /> {getLangText(LANG_KEYS.GEN_RESPONSE)}
							</Typography>
						)}
					</Box>
				</>
			)}

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
					backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
						>
							<CancelIcon sx={{ fontSize: '14px' }} />
						</IconButton>
						<IconButton
							size="small"
							onClick={handleSaveAndExitEdit}
							disabled={
								isProcessing || !userEditInput.trim() || !botEditInput.trim() || isUserTextOverflow
							}
							title="Save Changes"
							color="secondary"
						>
							<SaveIcon sx={{ fontSize: '14px' }} />
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
									disabled={currentTempSetNo === 0}
									sx={{
										transition: 'color 0.2s ease-in-out',
										'&:hover': {
											color: theme.palette.warning.light, // Green
										},
									}}
								>
									<NavigateBeforeIcon sx={{ fontSize: '14px' }} />
								</IconButton>
								<Typography
									variant="caption"
									sx={{
										px: 0.5,
										fontSize: '11px',
										fontWeight: 500,
										color: 'rgba(255, 255, 255, 0.8)',
										userSelect: 'none',
									}}
								>
									{currentTempSetNo + 1}/{tempTurn.chatTurnSets.length}
								</Typography>
								<IconButton
									size="small"
									title="Next Response"
									onClick={handleNextSet}
									disabled={currentTempSetNo === tempTurn.chatTurnSets.length - 1}
									sx={{
										transition: 'color 0.2s ease-in-out',
										'&:hover': {
											color: theme.palette.warning.light, // Green
										},
									}}
								>
									<NavigateNextIcon sx={{ fontSize: '14px' }} />
								</IconButton>
							</>
						)}
						{currentSet.response && (
							<>
								{/* ✅ EDIT ICON - Turns blue on hover */}
								<IconButton
									size="small"
									onClick={handleStartEdit}
									disabled={isProcessing}
									title="Edit this turn"
									sx={{
										transition: 'color 0.2s ease-in-out',
										'&:hover': {
											color: theme.palette.primary.dark, // Blue
										},
									}}
								>
									<EditIcon sx={{ fontSize: '14px' }} />
								</IconButton>

								{/* ✅ REGENERATE ICON - Turns green on hover */}
								<IconButton
									size="small"
									onClick={onRegenerate}
									disabled={isProcessing}
									title="Regenerate Response"
									sx={{
										transition: 'color 0.2s ease-in-out',
										'&:hover': {
											color: theme.palette.success.main, // Green
										},
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
