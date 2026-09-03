import { alpha, styled, Tab, TabProps, Tabs, TabsProps } from '@mui/material';
import { ComponentType } from 'react';

export const GlassTabs: ComponentType<TabsProps> = styled(Tabs)(({ theme }) => ({
  borderBottom: `1px solid ${alpha(theme.palette.text.primary, 0.22)}`,
  minHeight: theme.spacing(3.5),
  '& .MuiTabs-flexContainer': { minHeight: theme.spacing(3.5) },
  '& .MuiTabs-indicator': { backgroundColor: theme.palette.text.secondary },
}));

export const GlassTab: ComponentType<TabProps> = styled(Tab)(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.palette.text.secondary,
  minHeight: theme.spacing(3.5),
  paddingBottom: theme.spacing(1),
  paddingTop: 0,
  textTransform: 'none',
  '&.Mui-selected': { color: theme.palette.text.secondary },
}));
