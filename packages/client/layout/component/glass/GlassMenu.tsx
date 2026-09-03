// src/client/layout/glass/GlassMenu.tsx

import { FC, ReactNode } from 'react';
import { Menu, MenuProps } from '@mui/material';
import { glassEffect, glassEffectLight } from '../../../style/glassEffect.js';

export interface GlassMenuProps extends Omit<MenuProps, 'children'> {
  children: ReactNode;
  /**
   * Anchor origin for the menu position
   * @default { horizontal: 'right', vertical: 'bottom' }
   */
  anchorOrigin?: { horizontal: 'left' | 'center' | 'right'; vertical: 'top' | 'center' | 'bottom' };
  /**
   * Transform origin for the menu animation
   * @default { horizontal: 'right', vertical: 'top' }
   */
  transformOrigin?: {
    horizontal: 'left' | 'center' | 'right';
    vertical: 'top' | 'center' | 'bottom';
  };
}

/**
 * A styled Menu component with glass morphism effect
 * Provides consistent styling across all dropdown menus in the app
 */
export const GlassMenu: FC<GlassMenuProps> = ({
  children,
  anchorOrigin = { horizontal: 'right', vertical: 'bottom' },
  transformOrigin = { horizontal: 'right', vertical: 'top' },
  onClick,
  ...props
}) => {
  return (
    <Menu
      anchorOrigin={anchorOrigin}
      transformOrigin={transformOrigin}
      disableAutoFocusItem={true}
      onClick={onClick}
      slotProps={{
        paper: {
          className: 'hide-scrollbar',
          sx: (theme) => {
            const styleObject = theme.palette.mode === 'dark' ? glassEffect : glassEffectLight;
            const { '&:hover': hoverStyles, ...baseStyles } = styleObject;

            return {
              ...baseStyles,
              // Apply hover styles only on non-mobile devices
              [theme.breakpoints.up('md')]: { ...hoverStyles },
            };
          },
        },
        // Remove list padding on mobile for better touch targets
        list: { sx: (theme) => ({ [theme.breakpoints.down('md')]: { padding: 0.5 } }) },
      }}
      {...props}
    >
      {children}
    </Menu>
  );
};
