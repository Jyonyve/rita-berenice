import { IconButton, IconButtonProps, styled } from '@mui/material';
import type { ComponentType } from 'react';
import { ColorVariant, getColorSet } from '../../style/colors.js';

interface HeaderIconButtonProps extends IconButtonProps {
	colorVariant?: ColorVariant;
}

export const HeaderIconButton: ComponentType<HeaderIconButtonProps> = styled(IconButton, {
	shouldForwardProp: (prop) => prop !== 'colorVariant',
})<HeaderIconButtonProps>(({ theme, colorVariant = 'silver' }) => {
	const colors = getColorSet(theme, colorVariant);

	return {
		color: colors.main,
		'& > .MuiSvgIcon-root, & > .MuiAvatar-root': { transition: 'filter 0.3s ease-in-out' },
		'&:hover': {
			color: colors.main,
			'& > .MuiSvgIcon-root, & > .MuiAvatar-root': { filter: `drop-shadow(0 0 6px ${colors.light})` },
		},
	};
});
