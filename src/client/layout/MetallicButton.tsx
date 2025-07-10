import { Button, styled } from '@mui/material';

export const MetallicButton = styled(Button)(({ theme }) => ({
	border: '1px solid',
	borderColor: theme.palette.primary.main,
	transition: 'all 0.3s ease-in-out',
	'&:hover': {
		borderImageSlice: 1,
		borderImageSource: `linear-gradient(to right, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
		boxShadow: `0 0 15px ${theme.palette.primary.main}`,
		backgroundColor: 'transparent',
	},
}));
