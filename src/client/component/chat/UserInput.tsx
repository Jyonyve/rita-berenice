import React, { FC, ChangeEventHandler } from 'react';
import {
	TextField,
	Button,
	CircularProgress,
	Box,
	Typography,
	useTheme, // Import useTheme for spacing
} from '@mui/material';
import { AiModelComp } from '../etc/AiModelComp.tsx'; // Ensure correct path

interface UserInputProps {
	sessionId: string;
	value: string;
	isProcessing: boolean;
	isDisabled: boolean;
	isLoadingCredentials?: boolean;
	onChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
	onSend: () => void;
}

export const UserInput: FC<UserInputProps> = ({
	sessionId,
	value,
	isProcessing,
	isDisabled,
	isLoadingCredentials,
	onChange,
	onSend,
}) => {
	const theme = useTheme(); // Hook to access theme values

	const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (!e.shiftKey && !isDisabled) {
			e.preventDefault();
			onSend();
		}
	};

	return (
		<>
			{/* Main container Box */}
			<Box sx={{ width: '100%', padding: theme.spacing(1) }}>
				{/* Add padding if needed */}
				{/* Row 1: Full Width TextField */}
				<TextField
					label="Enter your message"
					variant="outlined"
					fullWidth // Makes the TextField take the full width of its container [3][4][5]
					multiline
					// maxRows={4}
					value={value}
					onChange={onChange}
					disabled={isDisabled}
					onKeyDown={handleKeyDown}
					sx={{
						mb: 1.5, // Add margin-bottom for space before the next row
					}}
				/>
				{/* Row 2: Container for AiModelComp and Button */}
				<Box
					sx={{
						display: 'flex', // Use Flexbox for horizontal layout
						justifyContent: 'space-between', // Pushes AiModelComp left, Button right
						alignItems: 'center', // Vertically align items in the center of the row
						width: '100%', // Ensure this row also takes full width
					}}
				>
					<Box>
						{/* Optional Box wrapper if needed for specific styling */}
						<AiModelComp sessionId={sessionId} />
					</Box>

					{/* Right Item in Row 2 */}
					<Box>
						{/* Optional Box wrapper */}
						<Button
							variant="contained"
							onClick={onSend}
							disabled={isDisabled || !value.trim()} // Disable if processing or input empty
						>
							{isProcessing ? <CircularProgress size={24} color="inherit" /> : 'Send'}
						</Button>
					</Box>
				</Box>
			</Box>

			{/* Optional Loading Indicator (remains below the main input Box) */}
			{isLoadingCredentials && (
				<Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
					Loading credentials...
				</Typography>
			)}
		</>
	);
};
