import type { SxProps, Theme } from '@mui/material';

/** Keeps portalled MUI dialogs inside Safari's keyboard-reduced visual viewport. */
export const mobileVisualViewportDialogSx: SxProps<Theme> = (theme) => ({
	[theme.breakpoints.down('md')]: {
		top: 'var(--visual-viewport-offset-top, 0px)',
		bottom: 'auto',
		height: 'var(--visual-viewport-height, 100dvh)',
		'& .MuiDialog-container': { alignItems: 'center' },
		'& .MuiDialog-paper': {
			width: 'calc(100% - 24px)',
			maxHeight: 'calc(var(--visual-viewport-height, 100dvh) - 24px)',
			margin: 1.5,
		},
	},
});
