// src/client/component/page/chat/UserInput.tsx

import React, { FC, ChangeEventHandler } from 'react';
import { TextField, Button, CircularProgress, Box, useTheme } from '@mui/material';
import { AiModelSelector } from './AiModelSelector.jsx';
import { GlassBox, GlassButton, GlassMetallicButton } from '../../layout/glass/index.js';
import { useToast } from '../../provider/ToastProvider.jsx';
import { LANG_KEYS } from '#shared/config/langConstants.js';
import { getLangAlertText } from '#shared/util/languageUtils.js';

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
					slotProps={{ input: { sx: { fontSize: theme.typography.body2.fontSize } } }}
					onChange={onChange}
					disabled={isDisabled}
					onKeyDown={handleKeyDown}
				/>
			</GlassBox>
			{/* Row 2: Model Selector and Send Button */}
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					marginLeft: 1,
					marginRight: 1,
				}}
			>
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
