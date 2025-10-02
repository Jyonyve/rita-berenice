// src/client/component/page/chat/UserInput.tsx

import { Box, IconButton, Menu, TextField, useTheme } from '@mui/material';
import React, { ChangeEvent, ChangeEventHandler, FC, useState } from 'react';
import {
	GlassBox,
	GlassButton,
	GlassCircularProgress,
	GlassMenu,
	GlassMenuItem,
} from '../../layout/glass/index.js';
import { useToast } from '../../provider/ToastProvider.jsx';
import { getLangAlertText, getLangText } from '../../util/translateUtils.js';
import { AiModelSelector } from './AiModelSelector.jsx';
import { AdultSwitch } from '../../layout/AdultSwitch.jsx';
import SettingsIcon from '@mui/icons-material/Settings';
import { silver } from '../../style/index.js';
import { LANG_KEYS, REQUEST_CHARACTER_LIMIT } from '@rita-berenice/shared/config';
import { SessionInfo, AllModelNames } from '@rita-berenice/shared/domain';

interface UserInputProps {
	sessionInfo: SessionInfo;
	value: string;
	isProcessing: boolean;
	isDisabled: boolean;
	onChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
	onSend: () => void;
	modelName: AllModelNames;
	onAiModel: (modelName: AllModelNames) => void;
	isScene: boolean;
	onScene: (event: ChangeEvent<HTMLInputElement>, checked: boolean) => void;
	onOpenUserNoteModal: () => void;
}

export const UserInput: FC<UserInputProps> = ({
	sessionInfo,
	value,
	isProcessing,
	isDisabled,
	onChange,
	onSend,
	modelName,
	onAiModel,
	isScene,
	onScene,
	onOpenUserNoteModal,
}) => {
	const { addToast } = useToast();
	const theme = useTheme();
	const [elapsedSeconds, setElapsedSeconds] = useState<number>();

	// State for controlling the settings dropdown menu
	const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
	const isMenuOpen = Boolean(anchorEl);

	// Settings menu handlers
	const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
		setAnchorEl(event.currentTarget);
	};

	const handleMenuClose = () => {
		setAnchorEl(null);
	};

	const handleSend = async () => {
		if (import.meta.env.VITE_APP_MODE === 'static') {
			addToast(getLangAlertText(LANG_KEYS.STATIC_SENDING_DISABLE), 'warning');
			return;
		}

		const startTime = performance.now();

		try {
			onSend();
			const endTime = performance.now();
			const seconds = parseFloat(((endTime - startTime) / 1000).toFixed(1));
			setElapsedSeconds(seconds);
		} catch (error) {
			console.error('Send failed:', error);
		}
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === 'Enter') {
			if (event.ctrlKey || event.metaKey) {
				event.preventDefault();
				if (!isDisabled && value.trim()) {
					handleSend();
				}
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
						formHelperText: { sx: { textAlign: 'right', m: 0, mr: 1 } },
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
					{/* Settings Icon and Menu */}
					<IconButton
						onClick={handleMenuOpen}
						aria-label="session settings"
						aria-controls={isMenuOpen ? 'session-setting-menu' : undefined}
						aria-haspopup="true"
						sx={{
							color: 'silver',
							transition: 'all 0.3s ease-in-out',
							'&:hover': { color: silver.main },
						}}
					>
						<SettingsIcon />
					</IconButton>
					<GlassMenu
						id="session-setting-menu"
						anchorEl={anchorEl}
						open={isMenuOpen}
						onClose={handleMenuClose}
						onClick={handleMenuClose}
						// Changed: Open upward from bottom-left
						anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
						transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
					>
						<GlassMenuItem
							onClick={() => {
								handleMenuClose();
								onOpenUserNoteModal();
							}}
							colorVariant="silver"
						>
							{getLangText(LANG_KEYS.USER_NOTE)}
						</GlassMenuItem>
					</GlassMenu>

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
					{isProcessing ? (
						<GlassCircularProgress size={22} colorVariant="silver" seconds={elapsedSeconds} />
					) : (
						getLangText(LANG_KEYS.SEND)
					)}
				</GlassButton>
			</Box>
		</Box>
	);
};
