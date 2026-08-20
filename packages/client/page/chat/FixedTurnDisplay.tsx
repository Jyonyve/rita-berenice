import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import { Box, IconButton, TextField, useTheme } from '@mui/material';
import { FC, memo, useState } from 'react';
import { DisplayTurn } from '@rita-berenice/shared/domain';
import type { ChatDisplayMode } from './chatDisplayMode.js';
import {
	LANG_KEYS,
	REQUEST_CHARACTER_LIMIT,
	RESPONSE_EDIT_CHARACTER_LIMIT,
} from '@rita-berenice/shared/config';
import type { PortraitUrlMap } from '@rita-berenice/shared/config';
import { getConversationAvatar } from './conversationAvatarUtils.js';
import { ConversationMessage } from './ConversationMessage.js';
import { ConversationEntry } from './ConversationEntry.js';
import { GlassBox } from '../../layout/component/glass/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { parseEntriesToText } from '../../util/chatParseUtils.js';

interface FixedTurnDisplayProps {
	turn: DisplayTurn;
	onUpdateTurn: (sequence: number, userText: string, botText: string) => Promise<void>;
	onDeleteFromHere: (sequence: number) => Promise<void>;
	displayMode: ChatDisplayMode;
	characterPortraitUrls?: PortraitUrlMap;
	characterAvatarUrls?: PortraitUrlMap;
	profileAvatarUrl?: string;
	localizeDirections?: boolean;
}

export const FixedTurnDisplay: FC<FixedTurnDisplayProps> = memo(
	({
		turn,
		onUpdateTurn,
		onDeleteFromHere,
		displayMode,
		characterPortraitUrls,
		characterAvatarUrls,
		profileAvatarUrl,
		localizeDirections,
	}) => {
		const theme = useTheme();
		const [isEditing, setIsEditing] = useState(false);
		const [isBusy, setIsBusy] = useState(false);
		const [userEditInput, setUserEditInput] = useState('');
		const [botEditInput, setBotEditInput] = useState('');
		const [showActions, setShowActions] = useState(false);

		const handleToggleActions = () => {
			if (isEditing) return;
			setShowActions((prev) => !prev);
		};

		const isConversationMode = displayMode === 'conversation';
		const avatarUrl = getConversationAvatar(
			characterAvatarUrls,
			characterPortraitUrls,
			turn.response.emotion
		);

		const handleStartEdit = () => {
			setUserEditInput(parseEntriesToText(turn.request.entries));
			setBotEditInput(parseEntriesToText(turn.response.entries));
			setIsEditing(true);
		};

		const handleCancelEdit = () => setIsEditing(false);

		const handleSaveEdit = async () => {
			setIsBusy(true);
			try {
				await onUpdateTurn(turn.sequence, userEditInput, botEditInput);
				setIsEditing(false);
				setShowActions(false);
			} finally {
				setIsBusy(false);
			}
		};

		const handleDelete = async () => {
			if (!window.confirm(getLangText(LANG_KEYS.CONFIRM_DELETE_CHAT_TURN))) return;
			setIsBusy(true);
			try {
				await onDeleteFromHere(turn.sequence);
			} finally {
				setIsBusy(false);
			}
		};

		const isUserTextOverflow = userEditInput.length > REQUEST_CHARACTER_LIMIT;
		const isBotTextOverflow = botEditInput.length > RESPONSE_EDIT_CHARACTER_LIMIT;

		return (
			<Box
				key={`${turn.sessionId}-${turn.sequence}`}
				className={'turnContainer'}
				onClick={handleToggleActions}
				sx={{
					position: 'relative',
					paddingTop: theme.spacing(4.5),
					cursor: isEditing ? 'default' : 'pointer',
					'& .hover-buttons': {
						opacity: isEditing || showActions ? 1 : 0,
						visibility: isEditing || showActions ? 'visible' : 'hidden',
						transition: 'opacity 0.2s, visibility 0.2s',
					},
					...(!isEditing && {
						'&:hover': { '& .hover-buttons': { opacity: 1, visibility: 'visible' } },
					}),
				}}
			>
				{isEditing ? (
					<GlassBox gap={2}>
						<TextField
							fullWidth
							multiline
							label={turn.request.showName}
							variant="outlined"
							value={userEditInput}
							onChange={(e) => setUserEditInput(e.target.value)}
							disabled={isBusy}
							slotProps={{
								htmlInput: { maxLength: REQUEST_CHARACTER_LIMIT },
								input: { sx: { fontSize: theme.typography.body2.fontSize } },
							}}
							error={isUserTextOverflow}
							sx={{ mb: 3 }}
						/>
						<TextField
							fullWidth
							multiline
							label={turn.response.showName}
							variant="outlined"
							value={botEditInput}
							onChange={(e) => setBotEditInput(e.target.value)}
							disabled={isBusy}
							slotProps={{
								htmlInput: { maxLength: RESPONSE_EDIT_CHARACTER_LIMIT },
								input: { sx: { fontSize: theme.typography.body2.fontSize } },
							}}
							error={isBotTextOverflow}
						/>
					</GlassBox>
				) : isConversationMode ? (
					<>
						<ConversationMessage
							message={turn.request}
							role="user"
							avatarUrl={profileAvatarUrl}
							localizeDirections={localizeDirections}
						/>
						<ConversationMessage
							message={turn.response}
							role="assistant"
							avatarUrl={avatarUrl}
							localizeDirections={localizeDirections}
						/>
					</>
				) : (
					<>
						<Box sx={{ mb: 1 }}>
							{turn.request.entries.map((entry, idx) => (
								<Box key={`req-${turn.sequence}-${idx}`}>
									<ConversationEntry entry={entry} role="user" localizeDirections={localizeDirections} />
								</Box>
							))}
						</Box>
						<Box sx={{ mb: 1 }}>
							{turn.response.entries.map((entry, idx) => (
								<Box key={`res-${turn.sequence}-${idx}`}>
									<ConversationEntry
										entry={entry}
										role="assistant"
										localizeDirections={localizeDirections}
									/>
								</Box>
							))}
						</Box>
					</>
				)}

				<Box
					className="hover-buttons"
					onClick={(e) => e.stopPropagation()}
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
								disabled={isBusy}
								title={getLangText(LANG_KEYS.CANCEL_EDIT)}
							>
								<CancelIcon sx={{ fontSize: '14px' }} />
							</IconButton>
							<IconButton
								size="small"
								onClick={handleSaveEdit}
								disabled={
									isBusy ||
									!userEditInput.trim() ||
									!botEditInput.trim() ||
									isUserTextOverflow ||
									isBotTextOverflow
								}
								title={getLangText(LANG_KEYS.SAVE_CHANGES)}
								color="secondary"
							>
								<SaveIcon sx={{ fontSize: '14px' }} />
							</IconButton>
						</>
					) : (
						<>
							<IconButton
								size="small"
								onClick={handleStartEdit}
								disabled={isBusy}
								title={getLangText(LANG_KEYS.EDIT_THIS_TURN)}
								sx={{
									transition: 'color 0.2s ease-in-out',
									'&:hover': { color: theme.palette.primary.dark },
								}}
							>
								<EditIcon sx={{ fontSize: '14px' }} />
							</IconButton>
							{turn.sequence > 0 && (
								<IconButton
									size="small"
									onClick={handleDelete}
									disabled={isBusy}
									title={getLangText(LANG_KEYS.DELETE_FROM_HERE)}
									sx={{
										transition: 'color 0.2s ease-in-out',
										'&:hover': { color: theme.palette.error.main },
									}}
								>
									<DeleteIcon sx={{ fontSize: '14px' }} />
								</IconButton>
							)}
						</>
					)}
				</Box>
			</Box>
		);
	}
);

FixedTurnDisplay.displayName = 'FixedTurnDisplay';
