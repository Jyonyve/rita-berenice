// src/client/component/page/chat/UserInput.tsx

import {
  alpha,
  Alert,
  Box,
  Button,
  IconButton,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { ChangeEventHandler, FC, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GlassMenu, GlassMenuItem } from '../../layout/component/glass/index.js';
import { useToast } from '../../provider/ToastProvider.jsx';
import { getLangAlertText, getLangText } from '../../util/translateUtils.js';
import { AiModelSelector } from './AiModelSelector.jsx';
import SettingsIcon from '@mui/icons-material/Settings';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import KeyIcon from '@mui/icons-material/Key';
import StopCircleOutlinedIcon from '@mui/icons-material/StopCircleOutlined';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined';
import { LANG_KEYS, REQUEST_CHARACTER_LIMIT } from '@rita-berenice/shared/config';
import {
  API_KEY_TYPE_LABELS,
  getRequiredApiKeyType,
  type ApiKeyType,
  type SessionContentPolicy,
} from '@rita-berenice/shared/domain';
import type { ModelCatalogEntry } from '@rita-berenice/shared/api';
import type { ChatDisplayMode } from './chatDisplayMode.js';
import {
  DEFAULT_CHAT_FONT_SIZE,
  MAX_CHAT_FONT_SIZE,
  MIN_CHAT_FONT_SIZE,
  normalizeChatFontSize,
  type ChatFontSize,
  type ChatFontWeight,
} from './chatFontSize.js';
import { ApiKeyDialog } from './ApiKeyDialog.js';
import { useCredentialApi } from '../../hook/api/useCredentialApi.js';
import { AdultSwitch } from '../../layout/component/AdultSwitch.js';
import { HeaderIconButton } from '../../layout/component/HeaderIconButton.js';
import { SESSION_CONTROLS_ID } from '../../layout/SessionHeader.js';
import { silver } from '../../style/colors.js';

interface UserInputProps {
  userId: string;
  value: string;
  isProcessing: boolean;
  isDisabled: boolean;
  onChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onSend: () => void;
  onCancel: () => void;
  modelName: string;
  onAiModel: (modelName: string) => void;
  models?: ModelCatalogEntry[];
  displayMode: ChatDisplayMode;
  onDisplayMode: (mode: ChatDisplayMode) => void;
  chatFontSize: ChatFontSize;
  onChatFontSize: (fontSize: ChatFontSize) => void;
  chatFontWeight: ChatFontWeight;
  onChatFontWeight: (fontWeight: ChatFontWeight) => void;
  contentPolicy: SessionContentPolicy;
  isContentPolicyUpdating: boolean;
  onContentPolicy: (contentPolicy: SessionContentPolicy) => void;
  onOpenUserNoteModal: () => void;
  isMobileLayout: boolean;
  onFocusChange: (focused: boolean) => void;
  /** Set when a send failed on an API key problem; opens the dialog on that provider. */
  apiKeyPrompt?: ApiKeyType;
  onApiKeyPromptHandled?: () => void;
}

export const UserInput: FC<UserInputProps> = ({
  userId,
  value,
  isProcessing,
  isDisabled,
  onChange,
  onSend,
  onCancel,
  modelName,
  onAiModel,
  models,
  displayMode,
  onDisplayMode,
  chatFontSize,
  onChatFontSize,
  chatFontWeight,
  onChatFontWeight,
  contentPolicy,
  isContentPolicyUpdating,
  onContentPolicy,
  onOpenUserNoteModal,
  isMobileLayout,
  onFocusChange,
  apiKeyPrompt,
  onApiKeyPromptHandled,
}) => {
  const { addToast } = useToast();
  const theme = useTheme();
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [dialogKeyType, setDialogKeyType] = useState<ApiKeyType>();

  // Every chat request runs on the user's own key, so a model whose key is missing cannot
  // produce anything. Say so before the send rather than after a wasted round trip.
  const { data: apiKeyMetadata } = useCredentialApi().getUserApiKeyMetadata(userId);
  const selectedModel = models?.find((model) => model.id === modelName);
  const requiredKeyType = selectedModel
    ? getRequiredApiKeyType(selectedModel.platform, selectedModel.provider)
    : undefined;
  const isRequiredKeyMissing = Boolean(
    requiredKeyType && apiKeyMetadata && !apiKeyMetadata.configuredKeyTypes.includes(requiredKeyType),
  );

  const openApiKeyDialog = useCallback((keyType?: ApiKeyType) => {
    setDialogKeyType(keyType);
    setApiKeyDialogOpen(true);
  }, []);

  useEffect(() => {
    if (!apiKeyPrompt) return;
    openApiKeyDialog(apiKeyPrompt);
    onApiKeyPromptHandled?.();
  }, [apiKeyPrompt, openApiKeyDialog, onApiKeyPromptHandled]);

  // State for controlling the settings dropdown menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [headerControlsTarget, setHeaderControlsTarget] = useState<HTMLElement | null>(null);
  const isMenuOpen = Boolean(anchorEl);
  const canDecreaseFontSize = chatFontSize > MIN_CHAT_FONT_SIZE;
  const canIncreaseFontSize = chatFontSize < MAX_CHAT_FONT_SIZE;
  const sessionSettingControlHeight = 38;
  const sessionControlGlow = `0 0 8px 1px ${alpha(silver.main, theme.palette.mode === 'dark' ? 0.62 : 0.48)}`;
  const sessionToggleButtonSx = {
    height: sessionSettingControlHeight,
    transition: theme.transitions.create(['background-color', 'border-color', 'box-shadow'], {
      duration: 200,
    }),
    '&:hover, &.Mui-focusVisible': { boxShadow: sessionControlGlow, zIndex: 1 },
  };
  const stepChatFontSize = (step: -1 | 1) => {
    const nextFontSize = normalizeChatFontSize(chatFontSize + step);
    if (nextFontSize !== chatFontSize) onChatFontSize(nextFontSize);
  };

  useEffect(() => {
    setHeaderControlsTarget(document.getElementById(SESSION_CONTROLS_ID));
  }, []);

  useEffect(() => () => onFocusChange(false), [onFocusChange]);

  // Settings menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSend = async () => {
    if (import.meta.env.VITE_APP_MODE === 'static') {
      addToast(getLangAlertText(LANG_KEYS.STATIC_SENDING_DISABLE), 'warning');
      return;
    }

    try {
      onSend();
    } catch (error) {
      console.error('Send failed:', error);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        if (!isDisabled && value.trim()) {
          handleSend();
        }
      }
    }
  };

  const isSendDisabled = !isProcessing && (isDisabled || !value.trim());
  const sendControl = (
    <Tooltip title={isProcessing ? getLangText(LANG_KEYS.STOP_GENERATION) : getLangText(LANG_KEYS.SEND)}>
      <IconButton
        size="small"
        onPointerDown={(event) => event.preventDefault()}
        onClick={isProcessing ? onCancel : handleSend}
        disabled={isSendDisabled}
        aria-label={isProcessing ? getLangText(LANG_KEYS.STOP_GENERATION) : getLangText(LANG_KEYS.SEND)}
        sx={{ color: isProcessing ? 'text.secondary' : 'secondary.main' }}
      >
        {isProcessing ? <StopCircleOutlinedIcon /> : <SendRoundedIcon />}
      </IconButton>
    </Tooltip>
  );

  const settingsControl = (
    <HeaderIconButton
      onClick={handleMenuOpen}
      aria-label={getLangText(LANG_KEYS.SESSION_SETTINGS)}
      aria-controls={isMenuOpen ? 'session-setting-menu' : undefined}
      aria-haspopup="true"
    >
      <SettingsIcon />
    </HeaderIconButton>
  );

  return (
    <Box
      sx={{
        m: { xs: 0.5, sm: 1 },
        '& .MuiInputBase-input': { fontSize: { xs: '16px', md: theme.typography.body2.fontSize } },
      }}
    >
      {isRequiredKeyMissing && requiredKeyType ? (
        <Alert
          severity="warning"
          variant="outlined"
          sx={{ mb: 1, py: 0, alignItems: 'center' }}
          action={
            <Button size="small" color="inherit" onClick={() => openApiKeyDialog(requiredKeyType)}>
              {getLangText(LANG_KEYS.REGISTER_API_KEY)}
            </Button>
          }
        >
          {`${API_KEY_TYPE_LABELS[requiredKeyType]} ${getLangAlertText(LANG_KEYS.API_KEY_MISSING)}`}
        </Alert>
      ) : null}
      <Box>
        <TextField
          placeholder={getLangText(LANG_KEYS.MESSAGE_PLACEHOLDER)}
          variant="outlined"
          fullWidth
          multiline
          minRows={isMobileLayout ? 1 : 2}
          maxRows={isMobileLayout ? 3 : 4}
          value={value}
          slotProps={{
            htmlInput: { maxLength: REQUEST_CHARACTER_LIMIT },
            input: {
              endAdornment: (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
                    {`${value.length}/${REQUEST_CHARACTER_LIMIT}`}
                  </Typography>
                  {sendControl}
                </Box>
              ),
              sx: { pr: 0.5 },
            },
          }}
          onChange={onChange}
          disabled={isDisabled}
          onKeyDown={handleKeyDown}
          onFocus={() => isMobileLayout && onFocusChange(true)}
          onBlur={() => isMobileLayout && onFocusChange(false)}
          error={value.length > REQUEST_CHARACTER_LIMIT}
        />
      </Box>
      <Box sx={{ display: 'contents' }}>
        <Box sx={{ display: 'contents' }}>
          <GlassMenu
            id="session-setting-menu"
            anchorEl={anchorEl}
            open={isMenuOpen}
            onClose={handleMenuClose}
            onClick={handleMenuClose}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          >
            <GlassMenuItem
              onClick={() => {
                handleMenuClose();
                onOpenUserNoteModal();
              }}
              colorVariant="silver"
              compact
              sx={{ height: sessionSettingControlHeight, minHeight: sessionSettingControlHeight, py: 0 }}
            >
              <NoteAltOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
              {getLangText(LANG_KEYS.USER_NOTE)}
            </GlassMenuItem>
            <GlassMenuItem
              onClick={() => {
                handleMenuClose();
                openApiKeyDialog(requiredKeyType);
              }}
              colorVariant="silver"
              compact
              sx={{ height: sessionSettingControlHeight, minHeight: sessionSettingControlHeight, py: 0 }}
            >
              <KeyIcon fontSize="small" sx={{ mr: 1 }} />
              {getLangText(LANG_KEYS.API_KEYS)}
            </GlassMenuItem>
            <Box
              sx={{
                px: 1,
                py: 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                width: '100%',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <Tooltip
                title={getLangText(contentPolicy === 'adult' ? LANG_KEYS.ADULT_SESSION : LANG_KEYS.GENERAL_SESSION)}
              >
                <AdultSwitch
                  sx={{ height: sessionSettingControlHeight }}
                  checked={contentPolicy === 'adult'}
                  onChange={(_, checked) => onContentPolicy(checked ? 'adult' : 'general')}
                  disabled={isProcessing || isContentPolicyUpdating}
                  inputProps={{ 'aria-label': getLangText(LANG_KEYS.ADULT_SESSION) }}
                />
              </Tooltip>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={displayMode}
                onChange={(_event, mode: ChatDisplayMode | null) => {
                  if (mode) onDisplayMode(mode);
                }}
                aria-label={getLangText(LANG_KEYS.CHAT_DISPLAY_MODE)}
                sx={{
                  height: sessionSettingControlHeight,
                  '& .MuiToggleButton-root': sessionToggleButtonSx,
                }}
              >
                <Tooltip title={getLangText(LANG_KEYS.BOOK_MODE)}>
                  <ToggleButton value="book" aria-label={getLangText(LANG_KEYS.BOOK_MODE)}>
                    <MenuBookOutlinedIcon fontSize="small" />
                  </ToggleButton>
                </Tooltip>
                <Tooltip title={getLangText(LANG_KEYS.CONVERSATION_MODE)}>
                  <ToggleButton value="conversation" aria-label={getLangText(LANG_KEYS.CONVERSATION_MODE)}>
                    <ForumOutlinedIcon fontSize="small" />
                  </ToggleButton>
                </Tooltip>
              </ToggleButtonGroup>
            </Box>
            <Box
              sx={{
                px: 1,
                py: 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 1,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <Tooltip title={getLangText(chatFontWeight === 'bold' ? LANG_KEYS.BOLD_FONT : LANG_KEYS.NORMAL_FONT)}>
                <Switch
                  size="medium"
                  checked={chatFontWeight === 'bold'}
                  onChange={(_event, checked) => onChatFontWeight(checked ? 'bold' : 'normal')}
                  inputProps={{
                    'aria-label': getLangText(chatFontWeight === 'bold' ? LANG_KEYS.BOLD_FONT : LANG_KEYS.NORMAL_FONT),
                  }}
                  color="default"
                  sx={{
                    height: sessionSettingControlHeight,
                    '& .MuiSwitch-switchBase.Mui-checked .MuiSwitch-thumb': { backgroundColor: '#000' },
                    '& .MuiSwitch-thumb': {
                      backgroundColor: '#000',
                      boxShadow: `0 0 3px ${alpha(silver.main, 0.72)}, 0 0 7px ${alpha(silver.light, 0.42)}`,
                      '&:before': {
                        content: chatFontWeight === 'bold' ? '"B"' : '"N"',
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: chatFontWeight === 'bold' ? 700 : 400,
                        color: '#fff',
                      },
                    },
                  }}
                />
              </Tooltip>
              <ToggleButtonGroup
                size="small"
                aria-label={getLangText(LANG_KEYS.CHAT_FONT_SIZE)}
                sx={{
                  height: sessionSettingControlHeight,
                  '& .MuiToggleButton-root': sessionToggleButtonSx,
                }}
              >
                <Tooltip title={getLangText(LANG_KEYS.DECREASE_FONT_SIZE)}>
                  <ToggleButton
                    value="decrease"
                    onClick={() => stepChatFontSize(-1)}
                    aria-label={getLangText(LANG_KEYS.DECREASE_FONT_SIZE)}
                    aria-disabled={!canDecreaseFontSize}
                    sx={{ width: 34, opacity: canDecreaseFontSize ? 1 : 0.38 }}
                  >
                    −
                  </ToggleButton>
                </Tooltip>
                <Tooltip title={getLangText(LANG_KEYS.MEDIUM_FONT)}>
                  <ToggleButton
                    value="default"
                    selected={chatFontSize === DEFAULT_CHAT_FONT_SIZE}
                    onClick={() => onChatFontSize(DEFAULT_CHAT_FONT_SIZE)}
                    aria-label={getLangText(LANG_KEYS.MEDIUM_FONT)}
                    sx={{ width: 34, fontSize: chatFontSize, lineHeight: 1 }}
                  >
                    A
                  </ToggleButton>
                </Tooltip>
                <Tooltip title={getLangText(LANG_KEYS.INCREASE_FONT_SIZE)}>
                  <ToggleButton
                    value="increase"
                    onClick={() => stepChatFontSize(1)}
                    aria-label={getLangText(LANG_KEYS.INCREASE_FONT_SIZE)}
                    aria-disabled={!canIncreaseFontSize}
                    sx={{ width: 34, opacity: canIncreaseFontSize ? 1 : 0.38 }}
                  >
                    +
                  </ToggleButton>
                </Tooltip>
              </ToggleButtonGroup>
            </Box>
            <Box
              sx={{
                width: '100%',
                minWidth: 0,
                maxWidth: 'calc(100vw - 32px)',
                px: 0.75,
                py: 0.5,
                display: 'flex',
                alignItems: 'center',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <AiModelSelector
                modelName={modelName}
                onAiModel={onAiModel}
                models={models}
                disableMenuTransition
                compact
              />
            </Box>
          </GlassMenu>
        </Box>
      </Box>
      {headerControlsTarget ? createPortal(settingsControl, headerControlsTarget) : null}
      <ApiKeyDialog
        open={apiKeyDialogOpen}
        userId={userId}
        initialKeyType={dialogKeyType}
        onClose={() => setApiKeyDialogOpen(false)}
      />
    </Box>
  );
};
