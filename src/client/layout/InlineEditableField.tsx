import React, { useState, useEffect, FC, useRef } from 'react';
import { TextField, Typography, IconButton, Box, TypographyProps } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import EditIcon from '@mui/icons-material/Edit';

interface InlineEditableFieldProps {
	initialValue: string;
	onSave: (newValue: string) => void;
	onCancel?: () => void;
	disabled?: boolean;
	typographyProps?: TypographyProps;
	textFieldProps?: {
		variant?: 'standard' | 'outlined' | 'filled';
		size?: 'small' | 'medium';
		multiline?: boolean;
		maxRows?: number;
	};
}

export const InlineEditableField: FC<InlineEditableFieldProps> = ({
	initialValue,
	onSave,
	onCancel,
	disabled = false,
	typographyProps,
	textFieldProps = { variant: 'standard', size: 'small' },
}) => {
	const [isEditing, setIsEditing] = useState(false);
	const [value, setValue] = useState(initialValue);
	const containerRef = useRef<HTMLDivElement>(null);

	// Sync with external changes
	useEffect(() => {
		setValue(initialValue);
	}, [initialValue]);

	// Handle clicking outside to cancel
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				handleCancel();
			}
		};
		if (isEditing) {
			document.addEventListener('mousedown', handleClickOutside);
		}
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isEditing, initialValue]);

	const handleSave = () => {
		const trimmedValue = value.trim();
		if (trimmedValue && trimmedValue !== initialValue) {
			onSave(trimmedValue);
		}
		setIsEditing(false);
	};

	const handleCancel = () => {
		setValue(initialValue);
		setIsEditing(false);
		onCancel?.();
	};

	const handleKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === 'Enter' && !textFieldProps.multiline) {
			event.preventDefault();
			handleSave();
		} else if (event.key === 'Escape') {
			handleCancel();
		}
	};

	if (disabled) {
		return (
			<Typography {...typographyProps} color="text.secondary" noWrap>
				{initialValue}
			</Typography>
		);
	}

	if (isEditing) {
		return (
			<Box ref={containerRef} sx={{ display: 'flex', alignItems: 'center' }}>
				<TextField
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={handleKeyDown}
					autoFocus
					{...textFieldProps}
					sx={typographyProps}
				/>
				<IconButton
					onClick={handleSave}
					size="small"
					sx={{ p: '2px', color: 'success.main' }}
					aria-label="Save changes"
				>
					<CheckIcon sx={{ fontSize: '6px' }} />
				</IconButton>
			</Box>
		);
	}

	return (
		<Box
			onClick={() => setIsEditing(true)}
			sx={{
				display: 'flex',
				alignItems: 'center',
				gap: 0.5,
				cursor: 'pointer',
				'&:hover .edit-icon': { opacity: 1 },
			}}
		>
			<Typography {...typographyProps} color="text.secondary" noWrap>
				{value}
			</Typography>
			{/* <EditIcon
				className="edit-icon"
				sx={{ fontSize: '14px', color: 'text.secondary', opacity: 0.5, transition: 'opacity 0.2s' }}
			/> */}
		</Box>
	);
};
