import { useState } from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, Button } from '@mui/material';

export const useErrorDialog = (initialOpen: boolean = false, initialMessage?: string) => {
	const [open, setOpen] = useState(initialOpen);
	const [message, setMessage] = useState(initialMessage ?? '');

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
				<DialogTitle>Error</DialogTitle>
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
