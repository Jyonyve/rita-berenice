// src/client/component/page/chat/UserInput.tsx

import { LANG_KEYS } from '#shared/config/langConstants.js';
import {
	Box,
	CircularProgress,
	FormControlLabel,
	Switch,
	TextField,
	useTheme,
} from '@mui/material';
import React, { ChangeEvent, ChangeEventHandler, FC } from 'react';
import { GlassBox, GlassButton, GlassCircularProgress } from '../../layout/glass/index.js';
import { useToast } from '../../provider/ToastProvider.jsx';
import { getLangAlertText } from '../../util/translateUtils.js';
import { AiModelSelector } from './AiModelSelector.jsx';
import { AllModelNames } from '#shared/domain/aimodel/AiInfoTypes.js';
import { REQUEST_CHARACTER_LIMIT } from '#shared/config/constants.js';
import { AdultSwitch } from '../../layout/AdultSwitch.jsx';

interface UserInputProps {
	sessionId: string;
	value: string;
	isProcessing: boolean;
	isDisabled: boolean;
	onChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
	onSend: () => void;
	modelName: AllModelNames;
	onAiModel: (modelName: AllModelNames) => void;
	isScene: boolean;
	onScene: (event: ChangeEvent<HTMLInputElement>, checked: boolean) => void;
}

export const UserInput: FC<UserInputProps> = ({
	sessionId,
	value,
	isProcessing,
	isDisabled,
	onChange,
	onSend,
	modelName,
	onAiModel,
	isScene,
	onScene,
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
		<Box margin={1}>
			<Box>
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
						htmlInput: { maxLength: REQUEST_CHARACTER_LIMIT },
						input: { sx: { fontSize: theme.typography.body2.fontSize } },
					}}
					onChange={onChange}
					disabled={isDisabled}
					onKeyDown={handleKeyDown}
					error={value.length > REQUEST_CHARACTER_LIMIT}
					helperText={`${value.length} / ${REQUEST_CHARACTER_LIMIT}`}
				/>
			</Box>
			{/* Row 2: Model Selector and Send Button */}
			<Box
				sx={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					[theme.breakpoints.down('md')]: { pb: 1 },
				}}
			>
				<Box sx={{ display: 'flex', alignItems: 'center' }}>
					<AiModelSelector modelName={modelName} onAiModel={onAiModel} />
					<AdultSwitch
						checked={!!isScene}
						onChange={onScene}
						color="default"
						size="small"
						slotProps={{ input: { 'aria-label': 'toggle scene switch' } }}
						sx={{ ml: 1 }}
					/>
				</Box>
				<GlassButton
					variant="contained"
					colorVariant="secondary"
					onClick={handleSend}
					disabled={isDisabled || !value.trim()}
				>
					{isProcessing ? <GlassCircularProgress colorVariant="silver" /> : 'Send'}
				</GlassButton>
			</Box>
		</Box>
	);
};
