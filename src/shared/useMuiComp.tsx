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
import { supportAiModelInfo } from '#root/src/client/domain/index.ts';
// import { initializeAwsCredentials } from '@util/awsCredentialUtils';

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
export const SelectAiModel = ({ id }: { id?: string }) => {
	// Generate select options based on the supportingAiInfo record
	const extractAiModelSelect = () => {
		return Object.entries(supportAiModelInfo).map(([category, models], idx) => (
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
			<InputLabel htmlFor={id}>AI Models</InputLabel>
			<Select defaultValue="" id={id} label="AI Models">
				{/* <MenuItem value="">
					<em>None</em>
				</MenuItem> */}
				{extractAiModelSelect()}
			</Select>
		</FormControl>
	);
};
// export const AwsLoginChecker = () => {
// 	const [status, setStatus] = useState('');

// 	const checkLogin = async () => {
// 		try {
// 			await initializeAwsCredentials();
// 			setStatus('✅');
// 		} catch (error) {
// 			setStatus('❌');
// 		}
// 	};

// 	return (
// 		<Button onClick={checkLogin} color={status === '✅' ? 'success' : 'error'}>
// 			Check AWS Login<p>{status}</p>
// 		</Button>
// 	);
// };
