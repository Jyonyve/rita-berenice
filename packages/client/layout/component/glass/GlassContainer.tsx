// src/components/ui/GlassCard.tsx

import React, { useState, Children, cloneElement, isValidElement, FC } from 'react';
import { Card, styled, PaperProps, CardContent, CardContentProps } from '@mui/material';
import { getGlassEffect } from '../../../style/glassEffect.js';
import { HoverContext } from '../index.js';

const StyledGlassContainer = styled(Card)(({ theme }) => ({
  ...getGlassEffect(theme.palette.mode, { noGlow: true }),
  backgroundColor: 'transparent',
  borderRadius: Number(theme.shape.borderRadius) * 2,
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
}));

interface GlassContainerProps extends PaperProps {}

export const GlassContainer: FC<GlassContainerProps> = ({ children, sx, ...rest }) => {
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
      <HoverContext.Provider value={isHovering}>{children}</HoverContext.Provider>
    </StyledGlassContainer>
  );
};
