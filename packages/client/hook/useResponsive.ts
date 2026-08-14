// src/client/hook/useResponsive.ts

import { useTheme, useMediaQuery } from '@mui/material';

/**
 * A custom hook for responsive design that returns various screen size booleans.
 * @returns An object with boolean flags for different screen sizes.
 */
export const useResponsive = () => {
	const theme = useTheme();

	const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
	const isTabletScreen = useMediaQuery(theme.breakpoints.between('md', 'lg'));
	const isDesktopScreen = useMediaQuery(theme.breakpoints.up('lg'));
	const isPortrait = useMediaQuery('(orientation: portrait)');

	const isMobileScreen = isSmallScreen;
	const isTabletPortrait = isTabletScreen && isPortrait;
	const hasEnoughSpaceForDesktop = isDesktopScreen;
	const isWideTablet = isTabletScreen && !isPortrait;

	const shouldUseMobileLayout = isMobileScreen;
	const shouldUseTabletLayout = isTabletScreen;
	const layoutMode = isMobileScreen ? 'mobile' : isTabletScreen ? 'tablet' : 'desktop';

	return {
		isSmallScreen,
		isMobileScreen,
		isTabletScreen,
		isDesktopScreen,
		isTabletPortrait,
		hasEnoughSpaceForDesktop,
		isWideTablet,
		shouldUseMobileLayout,
		shouldUseTabletLayout,
		layoutMode,
	};
};
