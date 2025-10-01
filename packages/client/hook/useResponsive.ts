// src/client/hook/useResponsive.ts

import { useTheme, useMediaQuery } from '@mui/material';

/**
 * A custom hook for responsive design that returns various screen size booleans.
 * @returns An object with boolean flags for different screen sizes.
 */
export const useResponsive = () => {
	const theme = useTheme();

	const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
	const isTabletPortrait = useMediaQuery(
		'(min-width: 768px) and (max-width: 1024px) and (orientation: portrait)'
	);
	const hasEnoughSpaceForDesktop = useMediaQuery('(min-width: 1200px)');
	const isWideTablet = useMediaQuery(
		'(min-width: 1024px) and (max-width: 1199px) and (orientation: landscape)'
	);

	const shouldUseMobileLayout =
		isSmallScreen || isTabletPortrait || (!hasEnoughSpaceForDesktop && !isWideTablet);

	return {
		isSmallScreen,
		isTabletPortrait,
		hasEnoughSpaceForDesktop,
		isWideTablet,
		shouldUseMobileLayout,
	};
};
