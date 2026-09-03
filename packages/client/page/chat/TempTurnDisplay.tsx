// src/client/component/page/chat/TempTurnDisplay.tsx

import CancelIcon from '@mui/icons-material/Cancel';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ReplayIcon from '@mui/icons-material/Replay';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SaveIcon from '@mui/icons-material/Save';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { FC, memo, useEffect, useState } from 'react';
import { GlassButton, GlassCircularProgress, GlassBox } from '../../layout/component/glass/index.js';
import { getLangText } from '../../util/translateUtils.js';
import { parseEntriesToText } from '../../util/chatParseUtils.js';
import { LANG_KEYS, REQUEST_CHARACTER_LIMIT, RESPONSE_EDIT_CHARACTER_LIMIT } from '@rita-berenice/shared/config';
import { TempChatTurn, ChatMessageSet } from '@rita-berenice/shared/domain';
import { ConversationEntry } from './ConversationEntry.js';
import type { ChatDisplayMode } from './chatDisplayMode.js';
import type { PortraitUrlMap } from '@rita-berenice/shared/config';
import { getConversationAvatar } from './conversationAvatarUtils.js';
import { ConversationMessage } from './ConversationMessage.js';
import { isResponseEditAllowed, isResponseEditChangeAllowed } from '@rita-berenice/shared/util';

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
  onContinueResponse: () => void;
  onDelete: () => Promise<void>;
  changeTempSetNo: (index: number) => void;
  displayMode: ChatDisplayMode;
  characterPortraitUrls?: PortraitUrlMap;
  characterAvatarUrls?: PortraitUrlMap;
  profileAvatarUrl?: string;
  localizeDirections?: boolean;
}

/**
 * A component for displaying a temporary chat turn with inline editing capabilities.
 * It now uses dynamic labels and a background color change to indicate text overflow.
 */
export const TempTurnDisplay: FC<TempTurnDisplayProps> = memo(
  ({
    tempTurn,
    currentTempSetNo,
    isProcessing,
    userEditInput,
    botEditInput,
    onEditTempTurnText,
    onSaveTempTurnText,
    onRegenerate,
    onContinueResponse,
    onDelete,
    changeTempSetNo,
    displayMode,
    characterPortraitUrls,
    characterAvatarUrls,
    profileAvatarUrl,
    localizeDirections,
  }) => {
    const theme = useTheme();
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
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
    const handleDelete = async () => {
      setIsDeleting(true);
      try {
        await onDelete();
        setIsDeleteDialogOpen(false);
      } finally {
        setIsDeleting(false);
      }
    };

    const originalBotText = parseEntriesToText(currentSet.response.entries);
    const isUserTextOverflow = userEditInput.length > REQUEST_CHARACTER_LIMIT;
    const isBotEditInvalid = !isResponseEditAllowed(originalBotText, botEditInput);
    const isConversationMode = displayMode === 'conversation';
    const avatarUrl = currentSet.response
      ? getConversationAvatar(characterAvatarUrls, characterPortraitUrls, currentSet.response.emotion)
      : undefined;

    return (
      <Box
        className={'turnContainer'}
        sx={{
          position: 'relative',
          paddingTop: theme.spacing(4.5),
          '& .hover-buttons': {
            opacity: isEditing ? 1 : 0,
            visibility: isEditing ? 'visible' : 'hidden',
            transition: 'opacity 0.2s, visibility 0.2s',
            '@media (hover: none)': { opacity: 1, visibility: 'visible' },
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
              onChange={(e) => {
                if (isResponseEditChangeAllowed(botEditInput, e.target.value)) {
                  onEditTempTurnText(e.target.value, false);
                }
              }}
              disabled={isProcessing}
              slotProps={{
                htmlInput: {
                  maxLength:
                    botEditInput.length > RESPONSE_EDIT_CHARACTER_LIMIT ? undefined : RESPONSE_EDIT_CHARACTER_LIMIT,
                },
                input: { sx: { fontSize: theme.typography.body2.fontSize } },
              }}
              error={isBotEditInvalid}
            />
          </GlassBox>
        ) : isConversationMode ? (
          <>
            <ConversationMessage
              message={currentSet.request}
              role="user"
              avatarUrl={profileAvatarUrl}
              localizeDirections={localizeDirections}
            />
            {currentSet.response ? (
              <ConversationMessage
                message={currentSet.response}
                role="assistant"
                avatarUrl={avatarUrl}
                localizeDirections={localizeDirections}
              />
            ) : (
              <Typography sx={{ fontStyle: 'italic', color: 'gray' }}>
                <GlassCircularProgress size={12} sx={{ mr: 1 }} /> {getLangText(LANG_KEYS.GEN_RESPONSE)}
              </Typography>
            )}
          </>
        ) : (
          <>
            <Box sx={{ mb: 1 }}>
              {currentSet.request.entries.map((entry, idx) => (
                <Box key={`req-${idx}`}>
                  <ConversationEntry entry={entry} role="user" localizeDirections={localizeDirections} />
                </Box>
              ))}
            </Box>
            <Box>
              {currentSet.response ? (
                currentSet.response.entries.map((entry, idx) => (
                  <Box key={`res-${idx}`}>
                    <ConversationEntry entry={entry} role="assistant" localizeDirections={localizeDirections} />
                  </Box>
                ))
              ) : (
                <Typography sx={{ fontStyle: 'italic', color: 'gray' }}>
                  <GlassCircularProgress size={12} sx={{ mr: 1 }} /> {getLangText(LANG_KEYS.GEN_RESPONSE)}
                </Typography>
              )}
            </Box>
          </>
        )}

        {!isEditing && currentSet.response?.generationStatus === 'length_limited' ? (
          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 1 }}>
            {getLangText(LANG_KEYS.RESPONSE_LENGTH_LIMITED)}
          </Typography>
        ) : null}

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
                title={getLangText(LANG_KEYS.CANCEL_EDIT)}
              >
                <CancelIcon sx={{ fontSize: '14px' }} />
              </IconButton>
              <IconButton
                size="small"
                onClick={handleSaveAndExitEdit}
                disabled={
                  isProcessing ||
                  !userEditInput.trim() ||
                  !botEditInput.trim() ||
                  isUserTextOverflow ||
                  isBotEditInvalid
                }
                title={getLangText(LANG_KEYS.SAVE_CHANGES)}
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
                    title={getLangText(LANG_KEYS.PREVIOUS_RESPONSE)}
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
                    title={getLangText(LANG_KEYS.NEXT_RESPONSE)}
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
                  {currentSet.response.generationStatus === 'length_limited' ? (
                    <IconButton
                      size="small"
                      onClick={onContinueResponse}
                      disabled={isProcessing}
                      title={getLangText(LANG_KEYS.CONTINUE_RESPONSE)}
                      aria-label={getLangText(LANG_KEYS.CONTINUE_RESPONSE)}
                      sx={{ '&:hover': { color: theme.palette.warning.main } }}
                    >
                      <MoreHorizIcon sx={{ fontSize: '14px' }} />
                    </IconButton>
                  ) : null}
                  {/* ✅ EDIT ICON - Turns blue on hover */}
                  <IconButton
                    size="small"
                    onClick={handleStartEdit}
                    disabled={isProcessing}
                    title={getLangText(LANG_KEYS.EDIT_THIS_TURN)}
                    sx={{
                      transition: 'color 0.2s ease-in-out',
                      '&:hover': {
                        color: theme.palette.primary.dark, // Blue
                      },
                    }}
                  >
                    <EditIcon sx={{ fontSize: '14px' }} />
                  </IconButton>

                  <IconButton
                    size="small"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    disabled={isProcessing || isDeleting}
                    title={getLangText(LANG_KEYS.DELETE_TEMP_TURN)}
                    aria-label={getLangText(LANG_KEYS.DELETE_TEMP_TURN)}
                    sx={{ '&:hover': { color: theme.palette.error.main } }}
                  >
                    <DeleteOutlineIcon sx={{ fontSize: '14px' }} />
                  </IconButton>

                  {/* ✅ REGENERATE ICON - Turns green on hover */}
                  <IconButton
                    size="small"
                    onClick={onRegenerate}
                    disabled={isProcessing}
                    title={getLangText(LANG_KEYS.REGENERATE_RESPONSE)}
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
        <Dialog
          open={isDeleteDialogOpen}
          onClose={() => !isDeleting && setIsDeleteDialogOpen(false)}
          aria-labelledby="delete-temp-turn-dialog-title"
          aria-describedby="delete-temp-turn-dialog-description"
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle id="delete-temp-turn-dialog-title">{getLangText(LANG_KEYS.DELETE_TEMP_TURN)}</DialogTitle>
          <DialogContent>
            <DialogContentText id="delete-temp-turn-dialog-description">
              {getLangText(LANG_KEYS.CONFIRM_DELETE_TEMP_TURN)}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <GlassButton onClick={() => setIsDeleteDialogOpen(false)} colorVariant="silver" disabled={isDeleting}>
              {getLangText(LANG_KEYS.CANCEL)}
            </GlassButton>
            <GlassButton
              onClick={() => void handleDelete()}
              colorVariant="primary"
              disabled={isDeleting}
              aria-busy={isDeleting}
            >
              {getLangText(LANG_KEYS.DELETE_TEMP_TURN)}
            </GlassButton>
          </DialogActions>
        </Dialog>
      </Box>
    );
  },
);

TempTurnDisplay.displayName = 'TempTurnDisplay';
