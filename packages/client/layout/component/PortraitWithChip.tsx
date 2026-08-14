import React, { FC, ReactNode } from 'react';
import { Box, Chip, ChipProps } from '@mui/material';
import { GlassPortrait, GlassPortraitProps } from './glass/index.js';

// Define the props for the new component
interface PortraitWithChipProps {
	imageUrl: string;
	label: string;
	alt?: string;
	sx?: GlassPortraitProps['sx'];
	chipSx?: ChipProps['sx'];
	bottomRightOverlay?: ReactNode;
}

export const PortraitWithChip: FC<PortraitWithChipProps> = ({
	imageUrl,
	label,
	alt,
	sx,
	chipSx,
	bottomRightOverlay,
}) => {
	return (
		<Box sx={{ position: 'relative', display: 'inline-block', maxWidth: '100%', lineHeight: 0 }}>
			<GlassPortrait hover={false} imageUrl={imageUrl} alt={alt || label} sx={sx} />
			<Chip
				label={label}
				size="small"
				sx={{
					position: 'absolute',
					top: 12,
					right: 12,
					backgroundColor: 'rgba(0, 0, 0, 0.65)',
					color: 'white',
					backdropFilter: 'blur(4px)',
					border: '1px solid rgba(255, 255, 255, 0.2)',
					boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
					'& .MuiChip-label': { fontWeight: 'bold' },
					...chipSx, // Allow for external overrides
				}}
			/>
			{bottomRightOverlay}
		</Box>
	);
};
