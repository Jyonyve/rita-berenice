// src/client/layout/HoverBox.tsx

import React, { Children, cloneElement, isValidElement, FC } from 'react';
import { Box, BoxProps } from '@mui/material';

// Add 'isHovered' to the props interface
interface HoverBoxProps extends BoxProps {
	isHovered?: boolean;
}

export const HoverBox: FC<HoverBoxProps> = ({ children, isHovered = false, ...rest }) => {
	// The component no longer needs a hook. It receives the state directly.

	// It maps over its children and injects the 'isHovered' prop.
	const childrenWithGlow = Children.map(children, (child) => {
		if (isValidElement(child)) {
			// Clones the child (e.g., GlassPortrait) and passes the state as 'isHovered'.
			return cloneElement(child as React.ReactElement<any>, { isHovered });
		}
		return child;
	});

	return <Box {...rest}>{childrenWithGlow}</Box>;
};
