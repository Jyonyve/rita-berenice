import React, { FC, ChangeEventHandler } from 'react';
import { TextField, Button, CircularProgress, Box, Typography } from '@mui/material';
import styles from './ChatComp.module.scss'; // Assuming shared styles

interface UserInputProps {
	value: string;
	isProcessing: boolean;
	isDisabled: boolean; // Combines processing and temp turn state
	isLoadingCredentials?: boolean; // Optional loading state
	onChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
	onSend: () => void;
}

export const UserInput: FC<UserInputProps> = ({
	value,
	isProcessing,
	isDisabled,
	isLoadingCredentials,
	onChange,
	onSend,
}) => {
	const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (!e.shiftKey && !isDisabled) {
			e.preventDefault();
			onSend();
		}
	};

	return (
		<>
			<Box className={styles.inputArea}>
				<TextField
					label="Enter your message"
					variant="outlined"
					fullWidth
					multiline
					maxRows={4}
					value={value}
					onChange={onChange}
					disabled={isDisabled}
					onKeyDown={handleKeyDown}
				/>
				<Button
					variant="contained"
					onClick={onSend}
					disabled={isDisabled || !value.trim()} // Also disable if input is empty
					sx={{ alignSelf: 'flex-end' }}
				>
					{isProcessing ? <CircularProgress size={24} color="inherit" /> : 'Send'}
				</Button>
			</Box>
			{isLoadingCredentials && <Typography variant="caption">Loading credentials...</Typography>}
		</>
	);
};
