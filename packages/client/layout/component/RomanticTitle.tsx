// src/components/ui/Title.tsx

import React from 'react';
import { Typography, TypographyProps, useTheme } from '@mui/material';
import { logoFontFamily, titleFontFamily } from '../../style/typography.js';
import { ColorVariant, getColorSet } from '../../style/colors.js';
import { useHoverState } from './index.js';

// The props interface is correct. We will use 'hover' for clarity.
interface RomanticTitleProps extends TypographyProps {
  colorVariant?: ColorVariant;
  logo?: boolean;
  hover?: boolean; // We can go back to 'hover' as it's cleaner
  noGlow?: boolean;
}

export const RomanticTitle = (props: RomanticTitleProps) => {
  const { logo, color, colorVariant, hover, noGlow, sx, ...rest } = props;

  const hoverFromContext = useHoverState();
  const isHovering = hover != undefined ? hover : hoverFromContext;
  const theme = useTheme();
  const selectedVariant = colorVariant ?? (logo ? 'logo' : 'default');
  const colorSet = getColorSet(theme, selectedVariant);
  const hasPalettePriority = colorVariant != undefined || logo;
  const glowStyles = { textShadow: `0 0 8px ${colorSet.light}` };

  return (
    <Typography
      {...rest}
      color={color}
      sx={{
        fontFamily: logo ? logoFontFamily : titleFontFamily,
        ...(color == undefined && { color: colorSet.main }),
        whiteSpace: 'nowrap',
        transition: 'text-shadow 0.3s ease-in-out',
        ...(isHovering && glowStyles),
        ...(!noGlow && { '&:hover': glowStyles }),
        ...sx,
        ...(hasPalettePriority && {
          color: colorSet.main,
          ...(isHovering && glowStyles),
          ...(!noGlow && { '&:hover': glowStyles }),
        }),
      }}
    />
  );
};
