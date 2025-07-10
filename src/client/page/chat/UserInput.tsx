// src/client/component/page/chat/UserInput.tsx

import React, { FC, ChangeEventHandler } from 'react';
import { TextField, Button, CircularProgress, Box } from '@mui/material';
import { AiModelSelector } from './AiModelSelector.jsx';

interface UserInputProps {
	sessionId: string;
	value: string;
	isProcessing: boolean;
	isDisabled: boolean;
	onChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
	onSend: () => void;
}

export const UserInput: FC<UserInputProps> = ({
	sessionId,
	value,
	isProcessing,
	isDisabled,
	onChange,
	onSend,
}) => {
	// Function to handle Enter key press for sending the message
	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault(); // Prevents adding a new line
			if (!isDisabled && value.trim()) {
				onSend();
			}
		}
	};

	return (
		<Box sx={{ p: 1 }}>
			{/* Row 1: Full-width TextField with fixed height */}
			<TextField
				label="Enter your message"
				variant="outlined"
				fullWidth
				multiline
				rows={3} // Start with a height of 3 rows
				value={value}
				onChange={onChange}
				disabled={isDisabled}
				onKeyDown={handleKeyDown}
				sx={{ mb: 1.5 }} // Margin-bottom for spacing
			/>

			{/* Row 2: Model Selector and Send Button */}
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
				}}
			>
				<AiModelSelector sessionId={sessionId} />

				<Button
					variant="contained"
					color="primary"
					onClick={onSend}
					disabled={isDisabled || !value.trim()}
					sx={{ minWidth: '100px' }} // Give the button a consistent width
				>
					{isProcessing ? <CircularProgress size={24} color="inherit" /> : 'Send'}
				</Button>
			</Box>
		</Box>
	);
};
