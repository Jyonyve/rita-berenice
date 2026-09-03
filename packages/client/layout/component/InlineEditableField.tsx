import React, { useState, useEffect, FC, useRef } from 'react';
import { Box, CircularProgress, TextField, Tooltip, Typography, type TypographyProps } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { LANG_KEYS } from '@rita-berenice/shared/config';
import { getLangText } from '../../util/translateUtils.js';
import { HeaderIconButton } from './HeaderIconButton.js';

interface InlineEditableFieldProps {
  initialValue: string;
  onSave: (newValue: string) => void | Promise<void>;
  onCancel?: () => void;
  inputAriaLabel?: string;
  onTextClick?: () => void;
  showEditButton?: boolean;
  disabled?: boolean;
  typographyProps?: TypographyProps;
  textFieldProps?: {
    variant?: 'standard' | 'outlined' | 'filled';
    size?: 'small' | 'medium';
    multiline?: boolean;
    maxRows?: number;
  };
}

export const InlineEditableField: FC<InlineEditableFieldProps> = ({
  initialValue,
  onSave,
  onCancel,
  inputAriaLabel,
  onTextClick,
  showEditButton = false,
  disabled = false,
  typographyProps,
  textFieldProps = { variant: 'standard', size: 'small' },
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [value, setValue] = useState(initialValue);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync with external changes
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // Handle clicking outside to cancel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleCancel();
      }
    };
    if (isEditing && !isSaving) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, isSaving, initialValue]);

  const handleSave = async () => {
    const trimmedValue = value.trim();
    if (!trimmedValue || trimmedValue === initialValue) {
      setValue(initialValue);
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(trimmedValue);
      setValue(trimmedValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save inline field:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (isSaving) return;
    setValue(initialValue);
    setIsEditing(false);
    onCancel?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !textFieldProps.multiline) {
      event.preventDefault();
      void handleSave();
    } else if (event.key === 'Escape') {
      handleCancel();
    }
  };

  const handleTextClick = () => {
    if (onTextClick) {
      onTextClick();
      return;
    }
    setIsEditing(true);
  };

  const handleTextKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTextClick();
    }
  };

  if (disabled) {
    return (
      <Typography {...typographyProps} color="text.secondary" noWrap>
        {initialValue}
      </Typography>
    );
  }

  if (isEditing) {
    return (
      <Box ref={containerRef} aria-busy={isSaving} sx={{ display: 'flex', alignItems: 'center' }}>
        <TextField
          value={value}
          disabled={isSaving}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          slotProps={{ htmlInput: { 'aria-label': inputAriaLabel ?? getLangText(LANG_KEYS.EDIT) } }}
          {...textFieldProps}
          sx={typographyProps}
        />
        <HeaderIconButton
          onClick={() => void handleSave()}
          disabled={isSaving}
          size="small"
          aria-label={getLangText(LANG_KEYS.SAVE_CHANGES)}
        >
          {isSaving ? <CircularProgress size={14} color="inherit" /> : <CheckIcon sx={{ fontSize: 14 }} />}
        </HeaderIconButton>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        minWidth: 0,
        '& > .MuiTypography-root': { cursor: 'pointer' },
      }}
    >
      <Typography
        {...typographyProps}
        noWrap
        role="button"
        tabIndex={0}
        onClick={handleTextClick}
        onKeyDown={handleTextKeyDown}
      >
        {value}
      </Typography>
      {showEditButton && (
        <Tooltip title={getLangText(LANG_KEYS.EDIT)}>
          <HeaderIconButton
            size="small"
            onClick={() => setIsEditing(true)}
            aria-label={getLangText(LANG_KEYS.EDIT)}
            sx={{ p: 0.25, flexShrink: 0 }}
          >
            <EditOutlinedIcon sx={{ fontSize: 14 }} />
          </HeaderIconButton>
        </Tooltip>
      )}
    </Box>
  );
};
