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
// import { initializeAwsCredentials } from '@util/awsCredentialUtils';
import { ChatRoleType, ChatType, supportAiModelInfo } from '@shared/index.ts';
import styles from '../component/chat/ChatComp.module.scss';

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

export const styleEntryFont = (role: ChatRoleType, type: ChatType): string => {
	if (role === 'user') {
		return type === 'dialogue' ? styles.userDialogue : styles.userAction;
	} else {
		// assistant
		return type === 'dialogue' ? styles.assistantDialogue : styles.assistantAction;
	}
};

export const commonStyle = styles;
