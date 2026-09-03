import { Fragment, useState } from 'react';

import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  ListSubheader,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import { LANG_KEYS, SUPPORTED_MODEL_INFO } from '@rita-berenice/shared/config';
import { ChatRoleType } from '@rita-berenice/shared/domain';
import { format } from 'date-fns';
import { getLangText } from './translateUtils.js';

export const useErrorDialog = (initialMessage?: string) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(initialMessage ?? getLangText(LANG_KEYS.ERROR_OCCURRED));

  const showError = (msg: string) => {
    setMessage(msg);
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
  };

  return {
    showError,
    closeDialog,
    ErrorDialog: (
      <Dialog open={open} onClose={closeDialog}>
        <DialogTitle>{getLangText(LANG_KEYS.ERROR)}</DialogTitle>
        <DialogContent>{message}</DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    ),
  };
};
export const SelectAiModel = ({ id }: { id?: string }) => {
  // Generate select options based on the supportingAiInfo record
  const extractAiModelSelect = () => {
    return Object.entries(SUPPORTED_MODEL_INFO).map(([category, models], idx) => (
      <Fragment key={category}>
        <ListSubheader>
          <em>{category}</em>
        </ListSubheader>
        {Object.values(models).map((model, index) => (
          <MenuItem key={index} value={model}>
            {model}
          </MenuItem>
        ))}
      </Fragment>
    ));
  };

  return (
    <FormControl sx={{ m: 1, minWidth: 120 }}>
      <InputLabel htmlFor={id}>{getLangText(LANG_KEYS.AI_MODELS)}</InputLabel>
      <Select defaultValue="" id={id} label={getLangText(LANG_KEYS.AI_MODELS)}>
        {/* <MenuItem value="">
					<em>{getLangText(LANG_KEYS.NONE)}</em>
				</MenuItem> */}
        {extractAiModelSelect()}
      </Select>
    </FormControl>
  );
};

export const styleEntryFont = (role: ChatRoleType, type: 'dialogue' | 'action'): string => {
  if (role === 'user') {
    return type === 'dialogue' ? 'userDialogue' : 'userAction';
  } else {
    // assistant
    return type === 'dialogue' ? 'assistantDialogue' : 'assistantAction';
  }
};

export const formatTimestamp = (isoString: string, formatString?: string) => {
  const date = new Date(isoString);
  return format(date, formatString || 'yyyy-MM-dd HH:mm:ss');
};
