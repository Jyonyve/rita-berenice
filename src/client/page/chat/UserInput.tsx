// src/client/component/page/chat/UserInput.tsx

import { LANG_KEYS } from '#shared/config/langConstants.js';
import { Box, CircularProgress, TextField, useTheme } from '@mui/material';
import React, { ChangeEventHandler, FC } from 'react';
import { GlassBox, GlassButton } from '../../layout/glass/index.js';
import { useToast } from '../../provider/ToastProvider.jsx';
import { getLangAlertText } from '../../util/translateUtils.js';
import { AiModelSelector } from './AiModelSelector.jsx';

interface UserInputProps {
	sessionId: string;
	value: string;
	isProcessing: boolean;
	isDisabled: boolean;
	onChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
	onSend: () => void;
}

// --- [START OF CHANGE] ---
// Define the character limit as a constant for easy maintenance.
const CHARACTER_LIMIT = 1000;
// --- [END OF CHANGE] ---

export const UserInput: FC<UserInputProps> = ({
	sessionId,
	value,
	isProcessing,
	isDisabled,
	onChange,
	onSend,
}) => {
	const { addToast } = useToast();
	const theme = useTheme();

	const handleSend = () => {
		if (import.meta.env.VITE_APP_MODE === 'static') {
			addToast(getLangAlertText(LANG_KEYS.STATIC_SENDING_DISABLE), 'warning');
			return;
		} else {
			onSend();
		}
	};
	// Function to handle Enter key press for sending the message
	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault(); // Prevents adding a new line
			if (!isDisabled && value.trim()) {
				handleSend();
			}
		}
	};

	return (
		<Box>
			<GlassBox margin={1}>
				<TextField
					placeholder="Enter your message"
					variant="outlined"
					fullWidth
					multiline
					rows={2}
					value={value}
					slotProps={{
						formHelperText: {
							sx: {
								textAlign: 'right', // Aligns the counter to the right
								m: 0, // Removes the default margin for a tighter look
								mr: 1, // Adds a little margin to the right
							},
						},
						htmlInput: { maxLength: CHARACTER_LIMIT },
						input: { sx: { fontSize: theme.typography.body2.fontSize } },
					}}
					onChange={onChange}
					disabled={isDisabled}
					onKeyDown={handleKeyDown}
					error={value.length >= CHARACTER_LIMIT}
					helperText={`${value.length} / ${CHARACTER_LIMIT}`}
				/>
			</GlassBox>
			{/* Row 2: Model Selector and Send Button */}
			<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginX: 1 }}>
				<AiModelSelector />
				<GlassButton
					variant="contained"
					colorVariant="secondary"
					onClick={handleSend}
					disabled={isDisabled || !value.trim()}
				>
					{isProcessing ? <CircularProgress size={24} color="inherit" /> : 'Send'}
				</GlassButton>
			</Box>
		</Box>
	);
};
