import type { SxProps, Theme } from '@mui/material';

/** Keeps portalled MUI dialogs inside Safari's keyboard-reduced visual viewport. */
export const mobileVisualViewportDialogSx: SxProps<Theme> = (theme) => ({
  [theme.breakpoints.down('md')]: {
    top: 'calc(var(--visual-viewport-offset-top, 0px) + env(safe-area-inset-top))',
    bottom: 'auto',
    height: 'calc(var(--visual-viewport-height, 100dvh) - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
    '& .MuiDialog-container': { alignItems: 'center' },
    '& .MuiDialog-paper': {
      width: 'calc(100% - 24px)',
      maxHeight:
        'calc(var(--visual-viewport-height, 100dvh) - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 24px)',
      margin: 1.5,
    },
  },
});
