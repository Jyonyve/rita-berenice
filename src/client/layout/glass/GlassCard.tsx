// src/components/ui/GlassCard.tsx

import React, { useState, Children, cloneElement, isValidElement, FC } from 'react';
import { Card, styled, PaperProps, CardContent, CardContentProps } from '@mui/material';
import { getGlassEffect } from '../../style/glassEffect.js';
import { HoverContext } from '../index.js';

const StyledGlassContainer = styled(Card)(({ theme }) => ({
	...getGlassEffect(theme.palette.mode),
	backgroundColor: 'transparent',
	borderRadius: Number(theme.shape.borderRadius) * 2,
	display: 'flex',
	flexDirection: 'column',
	height: '100%',
}));

interface GlassCardProps extends PaperProps {
	contentProps?: CardContentProps;
}

export const GlassCard: FC<GlassCardProps> = ({ children, sx, contentProps, ...rest }) => {
	// This internal state management is perfectly correct.
	const [isHovering, setIsHovering] = useState(false);

	return (
		<StyledGlassContainer
			elevation={4}
			{...rest}
			onMouseEnter={() => setIsHovering(true)}
			onMouseLeave={() => setIsHovering(false)}
			sx={sx}
		>
			<HoverContext.Provider value={isHovering}>
				<CardContent {...contentProps}>{children}</CardContent>
			</HoverContext.Provider>
		</StyledGlassContainer>
	);
};
