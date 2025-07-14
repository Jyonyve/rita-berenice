// src/components/ui/GlassCard.tsx

import React, { useState, Children, cloneElement, isValidElement, FC } from 'react';
// Import CardContent to use it internally
import { Card, styled, PaperProps, CardContent, CardContentProps } from '@mui/material';
import { getGlassEffect } from '../../style/glassEffect.ts';

// The styled container, unchanged
const StyledGlassContainer = styled(Card)(({ theme }) => ({
	...getGlassEffect(theme.palette.mode),
	backgroundColor: 'transparent',
	borderRadius: Number(theme.shape.borderRadius) * 2,
	// Add flex properties to ensure the inner CardContent can fill the height
	display: 'flex',
	flexDirection: 'column',
	height: '100%',
}));

// We can add a prop to allow styling the internal CardContent
interface GlassCardProps extends PaperProps {
	contentProps?: CardContentProps;
}

export const GlassCard: FC<GlassCardProps> = ({ children, sx, contentProps, ...rest }) => {
	const [isHovered, setIsHovered] = useState(false);

	// The logic for passing the hover state down to children remains.
	// We'll pass it as 'isHovered' for consistency with our other components.
	const childrenWithGlow = Children.map(children, (child) => {
		if (isValidElement(child)) {
			return cloneElement(child as React.ReactElement<any>, { isHovered });
		}
		return child;
	});

	return (
		<StyledGlassContainer
			elevation={4}
			{...rest}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			sx={sx}
		>
			<CardContent {...contentProps}>{childrenWithGlow}</CardContent>
		</StyledGlassContainer>
	);
};
