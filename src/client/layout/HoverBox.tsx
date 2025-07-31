// src/client/layout/HoverBox.tsx

import React, { Children, cloneElement, isValidElement, FC } from 'react';
import { Box, BoxProps } from '@mui/material';

// Add 'hover' to the props interface
interface HoverBoxProps extends BoxProps {
	hover?: boolean;
}

export const HoverBox: FC<HoverBoxProps> = ({ children, hover = false, ...rest }) => {
	// The component no longer needs a hook. It receives the state directly.

	// It maps over its children and injects the 'hover' prop.
	const childrenWithGlow = Children.map(children, (child) => {
		if (isValidElement(child)) {
			// Clones the child (e.g., GlassPortrait) and passes the state as 'hover'.
			return cloneElement(child as React.ReactElement<any>, { hover: hover ? true : undefined });
		}
		return child;
	});

	return <Box {...rest}>{childrenWithGlow}</Box>;
};
